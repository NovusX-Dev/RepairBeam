import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { requirePermission } from "./permissionMiddleware";
import { hydrateAuthUser } from "./middleware/hydrateAuthUser";
import { setTenantContext } from "./middleware/tenantContext";
import { PERMISSIONS } from "@shared/permissions";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { aiService } from "./aiService";
import { deviceColorService } from "./deviceColorService";
import { normalizeCurrency, toCents, fromCents } from "@shared/money";
import { insertTicketSchema, insertChecklistSchema, isValidStatusTransition, getAllowedNextStatuses, type TicketStatus, insertSignatureRequestSchema } from "@shared/schema";
import { z } from "zod";
import { sendSignatureSMS, isTwilioConfigured } from "./services/twilio";
import { nanoid } from "nanoid";
import { rateLimit, createPhoneRateLimiter, createTokenRateLimiter, createTenantRateLimiter } from "./middleware/rateLimit";

const signatureSmsRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  storeName: 'signature-sms',
  message: 'Too many SMS requests. Please try again in an hour.',
  skipFailedRequests: true
});

const signatureSmsPerPhoneRateLimiter = createPhoneRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  storeName: 'signature-sms-phone',
  message: 'Too many SMS requests to this number. Please try again later.',
  skipFailedRequests: true
});

const publicSignatureRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  storeName: 'public-signature',
  message: 'Too many requests. Please try again later.'
});

const signatureSubmitRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  storeName: 'signature-submit',
  message: 'Too many signature attempts. Please try again later.'
});

const signatureSubmitPerTokenRateLimiter = createTokenRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  storeName: 'signature-submit-token',
  message: 'Too many attempts for this signature link.'
});

// Enhanced validation schema for tickets with currency normalization
const validateAndNormalizeCurrency = (value: any, ctx: z.RefinementCtx, fieldName: string) => {
  if (value === null || value === undefined || value === '') {
    return null; // Allow null/empty values
  }
  
  try {
    const normalized = normalizeCurrency(value, 'en');
    // Validate that the normalized value is a proper currency format
    if (!/^\d+\.\d{2}$/.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a valid currency amount (e.g., "123.45")`,
        path: [fieldName]
      });
      return z.NEVER;
    }
    return normalized;
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${fieldName} contains invalid currency format`,
      path: [fieldName]
    });
    return z.NEVER;
  }
};

const validatedTicketSchema = insertTicketSchema.extend({
  estimatedCost: z.any().nullable().transform((val, ctx) => 
    validateAndNormalizeCurrency(val, ctx, "estimatedCost")
  ),
  actualCost: z.any().nullable().transform((val, ctx) => 
    validateAndNormalizeCurrency(val, ctx, "actualCost")
  ),
  costEstimation: z.any().nullable().transform((val, ctx) => 
    validateAndNormalizeCurrency(val, ctx, "costEstimation")
  ),
  totalCost: z.any().nullable().transform((val, ctx) => 
    validateAndNormalizeCurrency(val, ctx, "totalCost")
  )
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check routes
  app.get('/api/health', async (req, res) => {
    try {
      const dbHealth = await storage.healthCheck();
      const status = dbHealth ? 'healthy' : 'unhealthy';
      const statusCode = dbHealth ? 200 : 503;
      
      res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        database: dbHealth ? 'connected' : 'disconnected'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Auth middleware
  await setupAuth(app);

  // Tenant context middleware (MUST run after auth)
  // This hydrates req.authUser from database and sets PostgreSQL session variable for RLS
  app.use("/api", hydrateAuthUser, setTenantContext);

  // Auth routes
  
  // Password-based login endpoint
  app.post('/api/auth/login', async (req: any, res, next) => {
    const passport = await import('passport');
    passport.default.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(400).json({ 
          message: info?.message || "Invalid email or password" 
        });
      }
      req.logIn(user, (err: any) => {
        if (err) {
          return next(err);
        }
        return res.json({
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            tenantId: user.tenantId,
          },
          mustChangePassword: user.mustChangePassword || false,
        });
      });
    })(req, res, next);
  });

  // Change password endpoint
  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ 
          message: "New password must be at least 8 characters long" 
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Block OIDC users from changing password (they use SSO)
      if (!user.passwordHash) {
        return res.status(400).json({ 
          message: "This account uses SSO login. Password cannot be changed here." 
        });
      }

      // Verify current password unless user must change password
      if (!user.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ 
            message: "Current password is required" 
          });
        }

        const { validatePassword } = await import('./utils/password.js');
        const isValid = await validatePassword(currentPassword, user.passwordHash);
        if (!isValid) {
          return res.status(400).json({ 
            message: "Current password is incorrect" 
          });
        }
      }

      // Validate new password strength
      const { validatePasswordStrength, hashPassword } = await import('./utils/password.js');
      const validation = validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ 
          message: "Password does not meet requirements",
          errors: validation.errors 
        });
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update user
      await storage.updateUser(userId, {
        passwordHash,
        mustChangePassword: false,
      });

      // Regenerate session to prevent session fixation
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Error regenerating session:', err);
        }
      });

      // Create audit log
      await storage.createAuditLog({
        tenantId: user.tenantId,
        userId: userId,
        action: 'change_password',
        resource: 'user',
        resourceId: userId,
        details: { selfService: true },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.json({
        ...req.authUser,
        mustChangePassword: req.authUser.mustChangePassword || false,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get current user's permissions (no permission required - users can see their own permissions)
  app.get("/api/auth/me/permissions", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.authUser.tenantId) {
        return res.json({ permissions: [] });
      }

      const permissions = await storage.getUserPermissions(req.authUser.id, req.authUser.tenantId);
      res.json({ permissions });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tenantId = req.authUser.tenantId;
      
      // Get basic counts for dashboard
      const [tickets, clients, inventoryItems, transactions, completionAnalytics] = await Promise.all([
        storage.getTickets(tenantId),
        storage.getClients(tenantId),
        storage.getInventoryItems(tenantId),
        storage.getTransactions(tenantId),
        storage.getCompletionAnalytics(tenantId, 100) // Get recent completion analytics
      ]);

      const openTickets = tickets.filter(t => t.status !== 'finalized').length;
      const completedTickets = tickets.filter(t => t.status === 'finalized').length;
      const totalTickets = tickets.length;
      const lowStockItems = inventoryItems.filter(item => item.quantity <= item.minQuantity).length;
      
      // Calculate monthly revenue from current month transactions
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = transactions
        .filter(t => {
          const transactionDate = new Date(t.createdAt!);
          return transactionDate.getMonth() === currentMonth && 
                 transactionDate.getFullYear() === currentYear;
        })
        .reduce((sum, t) => {
          const cents = toCents(t.total.toString(), 'en');
          return sum + cents;
        }, 0);

      const formattedMonthlyRevenue = fromCents(monthlyRevenue, 'en');

      // Calculate completion analytics metrics (return as numbers, not strings)
      const completionRate = totalTickets > 0 ? Math.round(((completedTickets / totalTickets) * 100) * 10) / 10 : 0;
      
      // Calculate average accuracy score from recent completions
      const avgAccuracyScore = completionAnalytics.length > 0 
        ? Math.round((completionAnalytics.reduce((sum, a) => sum + parseFloat(a.accuracyScore || '0'), 0) / completionAnalytics.length) * 10) / 10
        : 0;
      
      // Calculate revenue from completed tickets this month
      const completedTicketsThisMonth = tickets.filter(t => {
        if (t.status !== 'finalized' || !t.completedAt) return false;
        const completedDate = new Date(t.completedAt);
        return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
      });
      
      const completionRevenue = completedTicketsThisMonth.reduce((sum, t) => {
        if (t.finalActualCost) {
          const cents = toCents(t.finalActualCost.toString(), 'en');
          return sum + cents;
        }
        return sum;
      }, 0);
      
      const formattedCompletionRevenue = fromCents(completionRevenue, 'en');
      
      // Calculate time variance trend (positive = over-estimated, negative = under-estimated)
      const avgTimeVariance = completionAnalytics.length > 0
        ? Math.round((completionAnalytics.reduce((sum, a) => sum + parseFloat(a.hoursVariancePercentage || '0'), 0) / completionAnalytics.length) * 10) / 10
        : 0;
      
      // Calculate cost variance trend
      const avgCostVariance = completionAnalytics.length > 0
        ? Math.round((completionAnalytics.reduce((sum, a) => sum + parseFloat(a.costVariancePercentage || '0'), 0) / completionAnalytics.length) * 10) / 10
        : 0;

      // Calculate ticket status breakdown for pie chart
      const statusCounts: Record<string, number> = {};
      tickets.forEach(t => {
        const status = t.status || 'intake';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      const ticketStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalTickets > 0 ? Math.round(((count / totalTickets) * 100) * 10) / 10 : 0
      }));

      // Calculate daily revenue trend (last 7 days)
      const dailyRevenueTrend: { date: string; revenue: number; ticketCount: number }[] = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayTransactions = transactions.filter(t => {
          if (!t.createdAt) return false;
          const txDate = new Date(t.createdAt).toISOString().split('T')[0];
          return txDate === dateStr;
        });
        
        const dayRevenue = dayTransactions.reduce((sum, t) => {
          return sum + toCents(t.total.toString(), 'en');
        }, 0);
        
        const dayTickets = tickets.filter(t => {
          if (!t.createdAt) return false;
          const ticketDate = new Date(t.createdAt).toISOString().split('T')[0];
          return ticketDate === dateStr;
        }).length;
        
        dailyRevenueTrend.push({
          date: dateStr,
          revenue: dayRevenue / 100,
          ticketCount: dayTickets
        });
      }

      // Get recent activity (last 10 events)
      const recentActivity: { id: string; type: string; description: string; timestamp: string; metadata?: any }[] = [];
      
      // Add recent tickets
      const sortedTickets = [...tickets]
        .filter(t => t.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 5);
      
      sortedTickets.forEach(t => {
        recentActivity.push({
          id: `ticket-${t.id}`,
          type: 'ticket_created',
          description: `New ticket #${t.id.slice(0, 8)}`,
          timestamp: t.createdAt!.toString(),
          metadata: { deviceType: t.deviceType, deviceModel: t.deviceModel, status: t.status }
        });
      });
      
      // Add recent completed tickets
      const recentCompleted = [...tickets]
        .filter(t => t.status === 'finalized' && t.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 5);
      
      recentCompleted.forEach(t => {
        recentActivity.push({
          id: `completed-${t.id}`,
          type: 'ticket_completed',
          description: `Ticket #${t.id.slice(0, 8)} completed`,
          timestamp: t.completedAt!.toString(),
          metadata: { finalCost: t.finalActualCost, deviceType: t.deviceType }
        });
      });
      
      // Add recent transactions
      const sortedTransactions = [...transactions]
        .filter(t => t.createdAt)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 5);
      
      sortedTransactions.forEach(t => {
        recentActivity.push({
          id: `tx-${t.id}`,
          type: 'payment_received',
          description: `Payment of ${fromCents(toCents(t.total.toString(), 'en'), 'en')}`,
          timestamp: t.createdAt!.toString(),
          metadata: { paymentMethod: t.paymentMethod, total: t.total }
        });
      });
      
      // Sort all activity by timestamp and take top 10
      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const topRecentActivity = recentActivity.slice(0, 10);

      // Calculate previous month revenue for comparison
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonthRevenue = transactions
        .filter(t => {
          const transactionDate = new Date(t.createdAt!);
          return transactionDate.getMonth() === prevMonth && 
                 transactionDate.getFullYear() === prevYear;
        })
        .reduce((sum, t) => sum + toCents(t.total.toString(), 'en'), 0);
      
      const revenueChange = prevMonthRevenue > 0 
        ? Math.round((((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) * 10) / 10
        : monthlyRevenue > 0 ? 100.0 : 0;

      // Calculate previous month ticket count for comparison
      const prevMonthTickets = tickets.filter(t => {
        if (!t.createdAt) return false;
        const ticketDate = new Date(t.createdAt);
        return ticketDate.getMonth() === prevMonth && ticketDate.getFullYear() === prevYear;
      }).length;
      
      const currentMonthTickets = tickets.filter(t => {
        if (!t.createdAt) return false;
        const ticketDate = new Date(t.createdAt);
        return ticketDate.getMonth() === currentMonth && ticketDate.getFullYear() === currentYear;
      }).length;
      
      const ticketChange = prevMonthTickets > 0
        ? Math.round((((currentMonthTickets - prevMonthTickets) / prevMonthTickets) * 100) * 10) / 10
        : currentMonthTickets > 0 ? 100.0 : 0;

      // Calculate inventory total value
      const inventoryTotalValue = inventoryItems.reduce((sum, item) => {
        const price = parseFloat(item.cost?.toString() || '0');
        return sum + (price * item.quantity);
      }, 0);

      res.json({
        openTickets,
        monthlyRevenue: formattedMonthlyRevenue,
        lowStockItems,
        activeClients: clients.length,
        // Completion Analytics Metrics
        completionRate,
        completedTickets,
        totalTickets,
        avgAccuracyScore,
        completionRevenue: formattedCompletionRevenue,
        avgTimeVariance,
        avgCostVariance,
        recentCompletions: completionAnalytics.length,
        // New dashboard metrics
        ticketStatusBreakdown,
        dailyRevenueTrend,
        recentActivity: topRecentActivity,
        revenueChange,
        ticketChange,
        currentMonthTickets,
        inventoryTotalValue: inventoryTotalValue.toFixed(2),
        totalInventoryItems: inventoryItems.length
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // User routes
  app.get("/api/users", isAuthenticated, requirePermission(PERMISSIONS.USERS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const users = await storage.getUsersByTenant(req.authUser.tenantId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update current user's profile (self-service)
  app.put("/api/users/me", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { firstName, lastName, phone, telegram } = req.body;

      const updatedUser = await storage.upsertUser({
        id: req.authUser.id,
        email: req.authUser.email,
        firstName: firstName || req.authUser.firstName,
        lastName: lastName || req.authUser.lastName,
        phone: phone || null,
        telegram: telegram || null,
        profileImageUrl: req.authUser.profileImageUrl,
        tenantId: req.authUser.tenantId,
        role: req.authUser.role,
        status: req.authUser.status,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Delete a user (admin only)
  app.delete("/api/users/:id", isAuthenticated, requirePermission(PERMISSIONS.USERS_DELETE), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id: targetUserId } = req.params;

      // Prevent self-deletion
      if (targetUserId === req.authUser.id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      // Get target user to verify tenant
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify user belongs to same tenant
      if (targetUser.tenantId !== req.authUser.tenantId) {
        return res.status(403).json({ message: "Unauthorized to delete users from other tenants" });
      }

      // Delete user (cascading deletes handled by database)
      await storage.deleteUser(targetUserId);

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Client routes
  app.get("/api/clients", isAuthenticated, requirePermission(PERMISSIONS.CLIENTS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, search, page, limit } = req.query;
      const result = await storage.getClientsWithFilters(req.authUser.tenantId, {
        status: status as string,
        search: search as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 25
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // Client stats endpoint
  app.get("/api/clients/stats", isAuthenticated, requirePermission(PERMISSIONS.CLIENTS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const stats = await storage.getClientStats(req.authUser.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching client stats:", error);
      res.status(500).json({ message: "Failed to fetch client stats" });
    }
  });

  // Client search endpoint (must come before /api/clients/:id to avoid matching "search" as an id)
  app.get("/api/clients/search", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const clients = await storage.searchClients(req.authUser.tenantId, query.trim());
      res.json(clients);
    } catch (error) {
      console.error("Error searching clients:", error);
      res.status(500).json({ message: "Failed to search clients" });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, requirePermission(PERMISSIONS.CLIENTS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const client = await storage.getClient(id, req.authUser.tenantId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  // Ticket routes
  app.get("/api/tickets", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let tickets = await storage.getTicketsWithClients(req.authUser.tenantId);

      // Apply filters if provided in query params
      const { search, status, priority, assignedTo, deviceType, dateFrom, dateTo } = req.query;

      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        tickets = tickets.filter(ticket => 
          ticket.title?.toLowerCase().includes(searchLower) ||
          ticket.client?.firstName?.toLowerCase().includes(searchLower) ||
          ticket.client?.lastName?.toLowerCase().includes(searchLower) ||
          ticket.deviceModel?.toLowerCase().includes(searchLower) ||
          ticket.deviceBrand?.toLowerCase().includes(searchLower)
        );
      }

      if (status && typeof status === 'string' && status !== '') {
        tickets = tickets.filter(ticket => ticket.status === status);
      }

      if (priority && typeof priority === 'string' && priority !== '') {
        tickets = tickets.filter(ticket => ticket.priority === priority);
      }

      if (assignedTo && typeof assignedTo === 'string' && assignedTo !== '') {
        tickets = tickets.filter(ticket => ticket.assignedTo === assignedTo);
      }

      if (deviceType && typeof deviceType === 'string' && deviceType !== '') {
        tickets = tickets.filter(ticket => ticket.deviceType === deviceType);
      }

      if (dateFrom && typeof dateFrom === 'string') {
        const fromDate = new Date(dateFrom);
        tickets = tickets.filter(ticket => {
          const ticketDate = new Date(ticket.createdAt!);
          return ticketDate >= fromDate;
        });
      }

      if (dateTo && typeof dateTo === 'string') {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        tickets = tickets.filter(ticket => {
          const ticketDate = new Date(ticket.createdAt!);
          return ticketDate <= toDate;
        });
      }

      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  // Get tickets by client ID
  app.get("/api/tickets/client/:clientId", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { clientId } = req.params;
      const tickets = await storage.getTicketsByClientId(clientId, req.authUser.tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets by client:", error);
      res.status(500).json({ message: "Failed to fetch tickets by client" });
    }
  });

  // Check if ticket ID exists (for unique ID generation)
  app.get("/api/tickets/check-id/:ticketId", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const exists = await storage.checkTicketIdExists(ticketId, req.authUser.tenantId);
      res.json({ exists });
    } catch (error) {
      console.error("Error checking ticket ID:", error);
      res.status(500).json({ message: "Failed to check ticket ID" });
    }
  });

  // Get single ticket by ID with client details (must be after specific routes)
  app.get("/api/tickets/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const tickets = await storage.getTicketsWithClients(req.authUser.tenantId);
      const ticket = tickets.find(t => t.id === id);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  // Create new ticket
  app.post("/api/tickets", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_CREATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { issueResponses, ...ticketBody } = req.body;
      
      // Validate and normalize currency fields before creating ticket
      const validationResult = validatedTicketSchema.safeParse({
        ...ticketBody,
        tenantId: req.authUser.tenantId,
        // Convert clientDeadline string to Date object if it exists
        clientDeadline: req.body.clientDeadline ? new Date(req.body.clientDeadline) : null
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid ticket data", 
          errors: validationResult.error.errors 
        });
      }

      const ticketData = validationResult.data;
      const newTicket = await storage.createTicket(ticketData);

      // Link signature request to the new ticket if dropoffSignatureId is provided
      if (ticketData.dropoffSignatureId) {
        await storage.linkSignatureToTicket(ticketData.dropoffSignatureId, newTicket.id);
      }

      // Save issue responses if they exist
      if (issueResponses && Array.isArray(issueResponses) && issueResponses.length > 0) {
        for (const response of issueResponses) {
          await storage.createIssueResponse({
            ticketId: newTicket.id,
            questionId: response.questionId,
            response: JSON.stringify(response.answer)
          });
        }
      }

      res.status(201).json(newTicket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // Get ticket notes
  app.get("/api/tickets/:ticketId/notes", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const notes = await storage.getTicketNotes(ticketId, req.authUser.tenantId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching ticket notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  // Add ticket note
  app.post("/api/tickets/:ticketId/notes", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const { content } = req.body;
      
      const note = await storage.createTicketNote({
        ticketId,
        userId: req.authUser.id,
        content,
        tenantId: req.authUser.tenantId
      });
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating ticket note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  // Get ticket issue responses
  app.get("/api/tickets/:ticketId/issue-responses", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const responses = await storage.getIssueResponses(ticketId);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching issue responses:", error);
      res.status(500).json({ message: "Failed to fetch issue responses" });
    }
  });

  app.put("/api/tickets/:ticketId/status", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_CHANGE_STATUS), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      // Block finalized status - must use /api/tickets/:ticketId/finalize endpoint
      if (status === 'finalized') {
        return res.status(400).json({ 
          message: "Cannot set status to 'finalized' directly. Use the finalize endpoint with completion data.",
          error: "Finalization requires completion notes, actual hours, and cost. Please use the proper finalization workflow."
        });
      }

      // Get current ticket to validate status transition
      const currentTicket = await storage.getTicket(ticketId, req.authUser.tenantId);
      
      if (!currentTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Validate status transition
      const currentStatus = currentTicket.status as TicketStatus;
      const newStatus = status as TicketStatus;
      
      if (!isValidStatusTransition(currentStatus, newStatus)) {
        const allowedStatuses = getAllowedNextStatuses(currentStatus);
        return res.status(400).json({ 
          message: "Invalid status transition", 
          currentStatus,
          requestedStatus: newStatus,
          allowedStatuses,
          error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowedStatuses.join(', ')}`
        });
      }

      const updatedTicket = await storage.updateTicketStatus(ticketId, status, req.authUser.tenantId);
      
      if (!updatedTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(updatedTicket);
    } catch (error: any) {
      console.error("Error updating ticket status:", error);
      if (error.message === "Cannot modify finalized ticket") {
        return res.status(409).json({ message: "Cannot modify a finalized ticket" });
      }
      res.status(500).json({ message: "Failed to update ticket status" });
    }
  });

  // Finalize ticket with completion data
  app.put("/api/tickets/:ticketId/finalize", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_CHANGE_STATUS), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const { completionNotes, actualHours, finalActualCost, confirmedItemIds = [], warrantyType = 'standard' } = req.body;
      
      if (actualHours === undefined || finalActualCost === undefined) {
        return res.status(400).json({ message: "Actual hours and final cost are required" });
      }

      // Get all ticket items
      const ticketItems = await storage.getTicketItems(ticketId, req.authUser.tenantId);
      
      // Process each ticket item based on confirmation
      for (const ticketItem of ticketItems) {
        if (confirmedItemIds.includes(ticketItem.id)) {
          // Item was used - mark as confirmed
          await storage.updateTicketItem(ticketItem.id, req.authUser.tenantId, {
            confirmed: true,
          });
          
          // Update inventory units to record final usage timestamp
          const unitIds = ticketItem.inventoryUnitIds as string[];
          for (const unitId of unitIds) {
            await storage.updateInventoryUnit(unitId, {
              usedAt: new Date(), // Record when item was actually confirmed as used
              status: 'used', // Ensure status is 'used'
            });
          }
        } else {
          // Item was NOT used - return to inventory
          const inventoryItem = await storage.getInventoryItem(ticketItem.inventoryItemId, req.authUser.tenantId);
          if (inventoryItem) {
            // Return units to inventory
            const unitIds = ticketItem.inventoryUnitIds as string[];
            for (const unitId of unitIds) {
              await storage.updateInventoryUnit(unitId, {
                status: 'in_stock',
                ticketId: null,
                usedAt: null,
              });
            }

            // Add back to inventory quantity
            await storage.updateInventoryItem(inventoryItem.id, req.authUser.tenantId, {
              quantity: inventoryItem.quantity + ticketItem.quantity,
            });
          }

          // Delete the unconfirmed ticket item
          await storage.deleteTicketItem(ticketItem.id, req.authUser.tenantId);
        }
      }

      const finalizedTicket = await storage.finalizeTicket(
        ticketId, 
        req.authUser.tenantId,
        req.authUser.id,
        completionNotes || '', // Allow empty completion notes
        parseInt(actualHours),
        parseFloat(finalActualCost),
        warrantyType
      );
      
      if (!finalizedTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Update client metrics when ticket is finalized
      if (finalizedTicket.clientId) {
        try {
          // Calculate total cost in cents (finalActualCost is in reais/currency)
          const costInCents = Math.round(parseFloat(finalActualCost) * 100);
          
          await storage.updateClientMetrics(
            finalizedTicket.clientId,
            req.authUser.tenantId,
            {
              lastVisitAt: new Date(),
              totalSpendCents: costInCents,
              ticketCount: 1
            }
          );
        } catch (clientError) {
          console.error("Warning: Failed to update client metrics:", clientError);
          // Don't fail the finalization if client update fails
        }
      }

      res.json(finalizedTicket);
    } catch (error: any) {
      console.error("Error finalizing ticket:", error);
      if (error.message === "Cannot modify finalized ticket") {
        return res.status(409).json({ message: "Ticket is already finalized" });
      }
      res.status(500).json({ message: "Failed to finalize ticket" });
    }
  });

  // Archive all finalized tickets (cleanup from Kanban view)
  app.post("/api/tickets/archive-finalized", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_DELETE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const archivedCount = await storage.archiveFinalizedTickets(req.authUser.tenantId);
      
      res.json({ 
        success: true, 
        archivedCount,
        message: `Archived ${archivedCount} finalized ticket(s)` 
      });
    } catch (error: any) {
      console.error("Error archiving tickets:", error);
      res.status(500).json({ message: "Failed to archive tickets" });
    }
  });

  // Update ticket priority
  app.put("/api/tickets/:ticketId/priority", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const { priority } = req.body;
      
      if (!priority) {
        return res.status(400).json({ message: "Priority is required" });
      }

      const updatedTicket = await storage.updateTicketPriority(ticketId, priority, req.authUser.tenantId);
      
      if (!updatedTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(updatedTicket);
    } catch (error: any) {
      console.error("Error updating ticket priority:", error);
      if (error.message === "Cannot modify finalized ticket") {
        return res.status(409).json({ message: "Cannot modify a finalized ticket" });
      }
      res.status(500).json({ message: "Failed to update ticket priority" });
    }
  });

  // Delete ticket
  app.delete("/api/tickets/:ticketId", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_DELETE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      
      // Return ticket items to inventory before deleting
      const ticketItems = await storage.getTicketItems(ticketId, req.authUser.tenantId);
      for (const ticketItem of ticketItems) {
        const inventoryItem = await storage.getInventoryItem(ticketItem.inventoryItemId, req.authUser.tenantId);
        if (inventoryItem) {
          // Return units to inventory
          const unitIds = ticketItem.inventoryUnitIds as string[];
          for (const unitId of unitIds) {
            await storage.updateInventoryUnit(unitId, {
              status: 'in_stock',
              ticketId: null,
              usedAt: null,
            });
          }

          // Add back to inventory quantity
          await storage.updateInventoryItem(inventoryItem.id, req.authUser.tenantId, {
            quantity: inventoryItem.quantity + ticketItem.quantity,
          });
        }
      }

      // Delete all ticket items
      await storage.deleteTicketItemsByTicketId(ticketId, req.authUser.tenantId);

      // Delete the ticket
      const deleted = await storage.deleteTicket(ticketId, req.authUser.tenantId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json({ success: true, message: "Ticket deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting ticket:", error);
      if (error.message === "Cannot delete finalized ticket") {
        return res.status(409).json({ message: "Cannot delete a finalized ticket" });
      }
      res.status(500).json({ message: "Failed to delete ticket" });
    }
  });

  // Create sample tickets for testing Kanban (development only)
  app.post("/api/tickets/create-samples", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get or create a client first
      let clients = await storage.getClients(req.authUser.tenantId);
      let clientId;
      
      if (clients.length === 0) {
        // Create a sample client
        const sampleClient = await storage.createClient({
          tenantId: req.authUser.tenantId,
          firstName: "John",
          lastName: "Doe", 
          email: "john.doe@example.com",
          phone: "+1-555-0123",
          streetAddress: "123 Main St",
          streetNumber: "123",
        });
        clientId = sampleClient.id;
      } else {
        clientId = clients[0].id;
      }

      // Sample tickets for different stages
      const sampleTickets = [
        {
          tenantId: req.authUser.tenantId,
          clientId,
          title: "iPhone 12 Screen Replacement",
          description: "Customer dropped phone, screen is cracked",
          status: "backlog" as const,
          priority: "high" as const,
          deviceType: "iPhone",
          deviceModel: "iPhone 12",
          issueDescription: "Cracked screen, LCD still functional",
          estimatedCost: "149.99"
        },
        {
          tenantId: req.authUser.tenantId,
          clientId,
          title: "Samsung Galaxy Battery Issue",
          description: "Phone not holding charge, needs diagnostic",
          status: "waiting_diagnostics" as const,
          priority: "medium" as const,
          deviceType: "Samsung",
          deviceModel: "Galaxy S21",
          issueDescription: "Battery drains quickly, possible hardware issue",
          estimatedCost: "89.99"
        },
        {
          tenantId: req.authUser.tenantId,
          clientId,
          title: "MacBook Pro Water Damage",
          description: "Laptop exposed to water, won't boot",
          status: "waiting_client_approval" as const,
          priority: "urgent" as const,
          deviceType: "MacBook",
          deviceModel: "MacBook Pro 2021",
          issueDescription: "Water damage to motherboard, extensive repair needed",
          estimatedCost: "450.00"
        },
        {
          tenantId: req.authUser.tenantId,
          clientId,
          title: "iPad Screen and Digitizer",
          description: "Touch not responding, screen replacement approved",
          status: "approved" as const,
          priority: "medium" as const,
          deviceType: "iPad",
          deviceModel: "iPad Air 4",
          issueDescription: "Digitizer not responding to touch input",
          estimatedCost: "199.99"
        },
        {
          tenantId: req.authUser.tenantId,
          clientId,
          title: "Dell Laptop Keyboard Replacement",
          description: "Multiple keys not working, replacement in progress",
          status: "servicing" as const,
          priority: "low" as const,
          deviceType: "Laptop",
          deviceModel: "Dell XPS 13",
          issueDescription: "Several keys unresponsive, keyboard needs replacement",
          estimatedCost: "79.99"
        }
      ];

      const createdTickets = [];
      for (const ticket of sampleTickets) {
        const newTicket = await storage.createTicket(ticket);
        createdTickets.push(newTicket);
      }

      res.json({ message: `Created ${createdTickets.length} sample tickets`, tickets: createdTickets });
    } catch (error) {
      console.error("Error creating sample tickets:", error);
      res.status(500).json({ message: "Failed to create sample tickets" });
    }
  });

  // Inventory routes
  app.get("/api/inventory", isAuthenticated, requirePermission(PERMISSIONS.INVENTORY_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const searchQuery = req.query.search as string | undefined;
      
      let items;
      if (searchQuery && searchQuery.trim()) {
        items = await storage.searchInventoryItems(req.authUser.tenantId, searchQuery.trim());
      } else {
        items = await storage.getInventoryItems(req.authUser.tenantId);
      }
      
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  app.post("/api/inventory", isAuthenticated, requirePermission(PERMISSIONS.INVENTORY_CREATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const itemData = { ...req.body, tenantId: req.authUser.tenantId };
      const newItem = await storage.createInventoryItem(itemData);
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", isAuthenticated, requirePermission(PERMISSIONS.INVENTORY_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updatedItem = await storage.updateInventoryItem(id, req.authUser.tenantId, req.body);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ message: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:id", isAuthenticated, requirePermission(PERMISSIONS.INVENTORY_DELETE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteInventoryItem(id, req.authUser.tenantId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      res.json({ message: "Inventory item deleted successfully" });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ message: "Failed to delete inventory item" });
    }
  });

  // Ticket items routes
  app.get("/api/tickets/:ticketId/items", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const items = await storage.getTicketItems(ticketId, req.authUser.tenantId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching ticket items:", error);
      res.status(500).json({ message: "Failed to fetch ticket items" });
    }
  });

  // Get available service items for ticket (filtered by device type)
  app.get("/api/inventory/available-for-ticket/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { deviceType } = req.params;
      
      // Get all inventory items with supplier info for the tenant
      const allItemsWithSuppliers = await storage.getInventoryItemsWithSuppliers(req.authUser.tenantId);
      
      // Filter for service items only, with stock, matching device type or "Other"
      const availableItems = allItemsWithSuppliers.filter(item => {
        const isServiceItem = item.itemType === 'Service';
        const hasStock = item.quantity && item.quantity > 0;
        const matchesDeviceType = !deviceType || 
                                  item.deviceType === deviceType || 
                                  item.deviceType === null || 
                                  item.deviceType === '' ||
                                  item.deviceType === 'Other';
        
        return isServiceItem && hasStock && matchesDeviceType;
      });

      res.json(availableItems);
    } catch (error) {
      console.error("Error fetching available items:", error);
      res.status(500).json({ message: "Failed to fetch available items" });
    }
  });

  app.post("/api/tickets/:ticketId/items", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;
      const { inventoryItemId, quantity, unitPrice } = req.body;

      // Use atomic transaction to add ticket item and deduct inventory
      const ticketItem = await storage.addTicketItemWithInventoryDeduction({
        tenantId: req.authUser.tenantId,
        ticketId,
        inventoryItemId,
        quantity,
        unitPrice,
      });

      res.status(201).json(ticketItem);
    } catch (error) {
      console.error("Error adding item to ticket:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add item to ticket";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.delete("/api/tickets/:ticketId/items/:itemId", isAuthenticated, requirePermission(PERMISSIONS.TICKETS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { itemId } = req.params;

      // Use atomic transaction to remove ticket item and restore inventory
      await storage.removeTicketItemWithInventoryRestore({
        ticketItemId: itemId,
        tenantId: req.authUser.tenantId,
      });

      res.json({ message: "Item removed from ticket and returned to inventory" });
    } catch (error) {
      console.error("Error removing item from ticket:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to remove item from ticket";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Inventory unit tracking routes
  // Verify QR code / unique tag - used for scanning
  app.get("/api/inventory-units/verify/:uniqueTag", isAuthenticated, requirePermission(PERMISSIONS.INVENTORY_SCAN_QR), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { uniqueTag } = req.params;
      
      // Sanitize input
      if (!uniqueTag || uniqueTag.trim().length === 0) {
        return res.status(400).json({ message: "Invalid unit tag" });
      }
      
      // Get inventory unit by unique tag (with tenant isolation)
      const unit = await storage.getInventoryUnitByTag(uniqueTag, req.authUser.tenantId);
      
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }

      // Get the inventory item to get details
      const inventoryItem = await storage.getInventoryItem(unit.inventoryItemId, req.authUser.tenantId);
      
      if (!inventoryItem) {
        return res.status(404).json({ message: "Unit not found" });
      }

      // Return unit with item details
      res.json({
        ...unit,
        inventoryItem: {
          id: inventoryItem.id,
          name: inventoryItem.name,
          description: inventoryItem.description,
          sku: inventoryItem.sku,
          category: inventoryItem.category,
          deviceType: inventoryItem.deviceType,
          itemType: inventoryItem.itemType,
        },
      });
    } catch (error) {
      console.error("Error verifying inventory unit:", error);
      res.status(500).json({ message: "Failed to verify inventory unit" });
    }
  });

  app.get("/api/inventory-units/:unitId/history", isAuthenticated, requirePermission(PERMISSIONS.INVENTORY_VIEW_ANALYTICS), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { unitId } = req.params;
      const history = await storage.getInventoryUnitHistory(unitId, req.authUser.tenantId);
      
      if (!history) {
        return res.status(404).json({ message: "Inventory unit not found" });
      }

      res.json(history);
    } catch (error) {
      console.error("Error fetching inventory unit history:", error);
      res.status(500).json({ message: "Failed to fetch inventory unit history" });
    }
  });

  app.get("/api/inventory/:itemId/usage-stats", isAuthenticated, requirePermission(PERMISSIONS.INVENTORY_VIEW_ANALYTICS), async (req: any, res) =>{
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { itemId } = req.params;
      const stats = await storage.getInventoryItemUsageStats(itemId, req.authUser.tenantId);
      
      if (!stats || !stats.inventoryItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      res.json(stats);
    } catch (error) {
      console.error("Error fetching inventory usage stats:", error);
      res.status(500).json({ message: "Failed to fetch inventory usage stats" });
    }
  });

  // Get all inventory units for a specific item (for QR code printing)
  app.get("/api/inventory/:itemId/units", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { itemId } = req.params;
      
      // Verify the item belongs to this tenant
      const item = await storage.getInventoryItem(itemId, req.authUser.tenantId);
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      // Get all units for this item
      const units = await storage.getInventoryUnitsByItem(itemId, req.authUser.tenantId);
      res.json(units);
    } catch (error) {
      console.error("Error fetching inventory units:", error);
      res.status(500).json({ message: "Failed to fetch inventory units" });
    }
  });

  // Supplier routes
  app.get("/api/suppliers", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const suppliers = await storage.getSuppliers(req.authUser.tenantId);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_CREATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const supplierData = { ...req.body, tenantId: req.authUser.tenantId };
      const newSupplier = await storage.createSupplier(supplierData);
      res.status(201).json(newSupplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updatedSupplier = await storage.updateSupplier(id, req.authUser.tenantId, req.body);
      
      if (!updatedSupplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      res.json(updatedSupplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ message: "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_DELETE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteSupplier(id, req.authUser.tenantId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      res.json({ message: "Supplier deleted successfully" });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  });

  // Inventory category routes
  app.get("/api/inventory-categories", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const categories = await storage.getInventoryCategories(req.authUser.tenantId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching inventory categories:", error);
      res.status(500).json({ message: "Failed to fetch inventory categories" });
    }
  });

  app.post("/api/inventory-categories", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const categoryData = { ...req.body, tenantId: req.authUser.tenantId };
      const newCategory = await storage.createInventoryCategory(categoryData);
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating inventory category:", error);
      res.status(500).json({ message: "Failed to create inventory category" });
    }
  });

  app.put("/api/inventory-categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updatedCategory = await storage.updateInventoryCategory(id, req.authUser.tenantId, req.body);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "Inventory category not found" });
      }

      res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating inventory category:", error);
      res.status(500).json({ message: "Failed to update inventory category" });
    }
  });

  app.delete("/api/inventory-categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteInventoryCategory(id, req.authUser.tenantId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Inventory category not found" });
      }

      res.json({ message: "Inventory category deleted successfully" });
    } catch (error) {
      console.error("Error deleting inventory category:", error);
      res.status(500).json({ message: "Failed to delete inventory category" });
    }
  });

  // Purchase order routes
  app.get("/api/purchase-orders", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const purchaseOrders = await storage.getPurchaseOrders(req.authUser.tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.post("/api/purchase-orders", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_CREATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { supplierId, items, expectedDate, notes } = req.body;

      // Create the purchase order
      const poData = {
        tenantId: req.authUser.tenantId,
        supplierId,
        status: 'pending',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes: notes || null,
      };

      const newPO = await storage.createPurchaseOrder(poData);

      // Create PO items - store item details without creating inventory items
      // Inventory items will be created only when the PO is finalized/received
      for (const item of items) {
        await storage.createPurchaseOrderItem({
          purchaseOrderId: newPO.id,
          itemName: item.itemName,
          inventoryItemId: null, // No inventory item yet - will be created on finalization
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unitCost: '0.00',
          deviceType: item.deviceType || null,
          itemType: item.itemType || 'Service',
          description: item.description || null,
        });
      }

      res.status(201).json(newPO);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ message: "Failed to create purchase order" });
    }
  });

  app.get("/api/purchase-orders/:id/items", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      // Verify PO belongs to tenant
      const po = await storage.getPurchaseOrder(id, req.authUser.tenantId);
      if (!po) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      // Get PO items - itemName is now stored directly in the PO item
      const poItems = await storage.getPurchaseOrderItems(id);
      
      res.json(poItems);
    } catch (error) {
      console.error("Error fetching purchase order items:", error);
      res.status(500).json({ message: "Failed to fetch purchase order items" });
    }
  });

  app.post("/api/purchase-orders/:id/finalize", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_RECEIVE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { items } = req.body;

      // Get the PO
      const po = await storage.getPurchaseOrder(id, req.authUser.tenantId);
      if (!po) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      // Get PO items
      const poItems = await storage.getPurchaseOrderItems(id);

      let totalCost = 0;
      const createdUnits: any[] = []; // Track all created inventory units

      // Process each item
      for (const receivedItem of items) {
        // Match by PO item ID instead of inventory item ID
        const poItem = poItems.find(item => item.id === receivedItem.poItemId);
        if (!poItem) continue;

        // Update PO item with received quantity and unit cost
        await storage.updatePurchaseOrderItem(poItem.id, {
          receivedQuantity: receivedItem.receivedQuantity,
          unitCost: receivedItem.unitCost.toString(),
        });

        // Calculate total cost
        totalCost += receivedItem.receivedQuantity * receivedItem.unitCost;

        // Get or create inventory item
        let inventoryItemId = poItem.inventoryItemId;
        if (!inventoryItemId) {
          // Check if an inventory item with the same name AND supplier already exists
          const allInventoryItems = await storage.getInventoryItems(req.authUser.tenantId);
          const itemName = poItem.itemName || receivedItem.itemName;
          
          // Find matching item: prioritize same supplier, fallback to legacy items without supplierId
          const existingItem = allInventoryItems.find(
            (item: any) => 
              item.name.toLowerCase() === itemName.toLowerCase() &&
              (item.supplierId === po.supplierId || (!item.supplierId && !allInventoryItems.some((other: any) => 
                other.name.toLowerCase() === itemName.toLowerCase() && other.supplierId === po.supplierId
              )))
          );

          if (existingItem) {
            // Use existing inventory item and update its supplierId if it's null
            inventoryItemId = existingItem.id;
            if (!existingItem.supplierId) {
              await storage.updateInventoryItem(inventoryItemId, req.authUser.tenantId, {
                supplierId: po.supplierId,
              });
            }
          } else {
            // Create new inventory item (new item or same item from different supplier)
            const newInventoryItem = await storage.createInventoryItem({
              tenantId: req.authUser.tenantId,
              supplierId: po.supplierId,
              name: itemName,
              quantity: 0, // Will be updated below
              minQuantity: 0,
              category: receivedItem.categoryId || null,
              deviceType: poItem.deviceType || null,
              itemType: poItem.itemType || 'Service',
              description: poItem.description || null,
              cost: receivedItem.unitCost,
              price: receivedItem.sellingPrice,
            });
            inventoryItemId = newInventoryItem.id;
          }

          // Link the inventory item to the PO item
          await storage.updatePurchaseOrderItem(poItem.id, {
            inventoryItemId: inventoryItemId,
          });
        }

        // Generate unique IDs for each item and create inventory units
        for (let i = 0; i < receivedItem.receivedQuantity; i++) {
          const itemNameForTag = receivedItem.itemName || 'ITEM';
          const uniqueTag = `${itemNameForTag.substring(0, 3).toUpperCase()}-${Date.now()}-${i}`;
          
          const newUnit = await storage.createInventoryUnit({
            tenantId: req.authUser.tenantId,
            inventoryItemId: inventoryItemId,
            supplierId: po.supplierId || '',
            purchaseOrderItemId: poItem.id,
            uniqueTag,
            status: 'in_stock',
            deviceType: poItem.deviceType || null,
            itemType: poItem.itemType || 'Service',
            description: poItem.description || null,
          });
          
          // Track created unit with item name for QR code printing
          createdUnits.push({
            ...newUnit,
            inventoryItem: {
              name: receivedItem.itemName || poItem.itemName || 'Unknown Item',
            },
          });
        }

        // Update inventory item quantity and metadata
        const inventoryItem = await storage.getInventoryItem(inventoryItemId, req.authUser.tenantId);
        if (inventoryItem) {
          const oldQuantity = inventoryItem.quantity;
          const newQuantity = oldQuantity + receivedItem.receivedQuantity;
          
          // Parse old cost safely, default to 0 if invalid
          const oldCostStr = inventoryItem.cost || '0';
          const oldCost = !isNaN(parseFloat(oldCostStr)) ? parseFloat(oldCostStr) : 0;
          const newUnitCost = receivedItem.unitCost;
          
          // Calculate weighted average cost
          const weightedAverageCost = oldQuantity > 0 
            ? ((oldCost * oldQuantity) + (newUnitCost * receivedItem.receivedQuantity)) / newQuantity
            : newUnitCost;
          
          // Parse existing price safely, only update if empty or invalid
          const existingPriceStr = inventoryItem.price || '';
          const existingPrice = !isNaN(parseFloat(existingPriceStr)) ? parseFloat(existingPriceStr) : 0;
          const updatedPrice = existingPrice > 0
            ? inventoryItem.price // Keep existing valid price
            : receivedItem.sellingPrice; // Use new price for new/invalid items
          
          await storage.updateInventoryItem(inventoryItemId, req.authUser.tenantId, {
            quantity: newQuantity,
            cost: weightedAverageCost,
            price: updatedPrice,
            category: receivedItem.categoryId !== undefined ? (receivedItem.categoryId || null) : inventoryItem.category,
            supplierId: inventoryItem.supplierId || po.supplierId, // Ensure supplierId is set
            deviceType: poItem.deviceType || inventoryItem.deviceType || null,
            itemType: poItem.itemType || inventoryItem.itemType || 'Service',
            description: poItem.description || inventoryItem.description || null,
          });
        }
      }

      // Update PO status and total cost
      await storage.updatePurchaseOrder(id, req.authUser.tenantId, {
        status: 'received',
        receivedDate: new Date(),
        totalCost: totalCost.toFixed(2),
      });

      const response = { 
        message: "Purchase order finalized successfully",
        units: createdUnits,
        purchaseOrderId: po.id,
        receivedDate: new Date(),
      };
      
      console.log(`[PO Finalize] Returning ${createdUnits.length} units for QR code printing`);
      res.json(response);
    } catch (error) {
      console.error("Error finalizing purchase order:", error);
      res.status(500).json({ message: "Failed to finalize purchase order" });
    }
  });

  // Cancel PO route
  app.patch("/api/purchase-orders/:id/cancel", isAuthenticated, requirePermission(PERMISSIONS.PURCHASE_ORDERS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      // Get the PO to verify it's in pending status
      const po = await storage.getPurchaseOrder(id, req.authUser.tenantId);
      if (!po) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      if (po.status !== 'pending') {
        return res.status(400).json({ message: "Only pending purchase orders can be cancelled" });
      }

      // Update PO status to cancelled
      await storage.updatePurchaseOrder(id, req.authUser.tenantId, {
        status: 'cancelled',
      });

      res.json({ message: "Purchase order cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling purchase order:", error);
      res.status(500).json({ message: "Failed to cancel purchase order" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const transactions = await storage.getTransactions(req.authUser.tenantId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Support ticket routes
  app.get("/api/support-tickets", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const supportTickets = await storage.getSupportTickets(req.authUser.tenantId);
      res.json(supportTickets);
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      res.status(500).json({ message: "Failed to fetch support tickets" });
    }
  });

  // AI routing error analysis endpoint
  app.post("/api/ai/analyze-routing-error", async (req, res) => {
    try {
      const diagnosticInfo = req.body;
      console.log('🤖 Analyzing routing error with AI...');
      
      const analysis = await aiService.analyzeRoutingError(diagnosticInfo);
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing routing error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze routing error',
        suggestions: [
          {
            type: 'route',
            title: 'Go to Dashboard',
            description: 'Return to the main dashboard',
            path: '/',
            confidence: 0.9
          }
        ]
      });
    }
  });

  // Gamification API routes
  app.get("/api/gamification/progress", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      let progress = await storage.getUserProgress(userId, tenantId);
      
      // Create initial progress if none exists
      if (!progress) {
        progress = await storage.createUserProgress({
          userId,
          tenantId,
        });
      }
      
      res.json(progress);
    } catch (error) {
      console.error('Error fetching user progress:', error);
      res.status(500).json({ error: 'Failed to fetch user progress' });
    }
  });

  app.get("/api/gamification/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      const achievements = await storage.getUserAchievements(userId, tenantId);
      res.json(achievements);
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      res.status(500).json({ error: 'Failed to fetch user achievements' });
    }
  });

  app.get("/api/gamification/activities", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      const limit = parseInt(req.query.limit as string) || 20;
      const activities = await storage.getUserActivities(userId, tenantId, limit);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching user activities:', error);
      res.status(500).json({ error: 'Failed to fetch user activities' });
    }
  });

  app.post("/api/gamification/activity", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      const { activityType, entityType, entityId, experienceGained, metadata } = req.body;
      
      const activity = await storage.recordActivity({
        userId,
        tenantId,
        activityType,
        entityType,
        entityId,
        experienceGained: experienceGained || 0,
        metadata: metadata || {},
      });
      
      res.json(activity);
    } catch (error) {
      console.error('Error recording activity:', error);
      res.status(500).json({ error: 'Failed to record activity' });
    }
  });

  // Shop image upload routes
  app.post("/api/shop-images/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getShopImageUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // General object upload endpoint
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getShopImageUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Normalize upload URL to object path
  app.post("/api/objects/normalize", isAuthenticated, async (req, res) => {
    try {
      const { uploadURL } = req.body;
      if (!uploadURL) {
        return res.status(400).json({ error: "Upload URL is required" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ objectPath });
    } catch (error) {
      console.error("Error normalizing object path:", error);
      res.status(500).json({ error: "Failed to normalize object path" });
    }
  });

  // Serve uploaded shop images
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Tenant management routes
  app.post("/api/tenants", isAuthenticated, async (req: any, res) => {
    try {
      const { name, alias, shopImageUrl } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Tenant name is required" });
      }

      // Normalize shop image URL if provided
      const objectStorageService = new ObjectStorageService();
      const normalizedShopImageUrl = shopImageUrl 
        ? objectStorageService.normalizeObjectEntityPath(shopImageUrl) 
        : null;

      const tenant = await storage.createTenant({
        domain: name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      });

      // Create initial store settings with the tenant data
      await storage.createStoreSettings({
        tenantId: tenant.id,
        shopName: name,
        shopAlias: alias,
        shopLogoUrl: normalizedShopImageUrl,
        preferredLanguage: 'en'
      });

      // Initialize default defects and checklists for the new tenant
      await storage.initializeDefaultDefects(tenant.id);
      await storage.initializeDefaultChecklists(tenant.id);

      // Update user's tenant association
      if (req.authUser) {
        await storage.upsertUser({
          ...req.authUser,
          tenantId: tenant.id
        });
      }

      res.json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ error: "Failed to create tenant" });
    }
  });

  app.get("/api/tenants/current", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tenant = await storage.getTenant(req.authUser.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      res.json(tenant);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });


  // Get recent users for quick login (shows users who logged in before)
  app.get("/api/auth/recent-users", async (req, res) => {
    try {
      // Get recent users (limit to prevent abuse)
      const recentUsers = await storage.getRecentUsers(5);
      
      // Return limited user info for quick login display
      const userList = recentUsers.map((user: any) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.groupName || user.role, // Use group name if available, fallback to basic role
        shopLogoUrl: user.storeSettings?.shopLogoUrl,
        shopName: user.storeSettings?.shopName || 'Shop',
        shopAlias: user.storeSettings?.shopAlias,
        tenantDomain: user.tenant?.domain,
      }));
      
      res.json(userList);
    } catch (error) {
      console.error("Error fetching recent users:", error);
      res.json([]); // Return empty array on error
    }
  });

  // Localization routes
  app.get("/api/localizations", async (req, res) => {
    try {
      const { language } = req.query;
      const localizations = await storage.getLocalizations(language as string);
      res.json(localizations);
    } catch (error) {
      console.error("Error fetching localizations:", error);
      res.status(500).json({ message: "Failed to fetch localizations" });
    }
  });

  // Filter presets routes
  app.get("/api/filter-presets", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { pageType } = req.query;
      const presets = await storage.getFilterPresets(req.authUser.tenantId, req.authUser.id, pageType as string);
      res.json(presets);
    } catch (error) {
      console.error("Error fetching filter presets:", error);
      res.status(500).json({ message: "Failed to fetch filter presets" });
    }
  });

  app.post("/api/filter-presets", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const presetData = {
        ...req.body,
        tenantId: req.authUser.tenantId,
        userId: req.authUser.id
      };

      const preset = await storage.createFilterPreset(presetData);
      res.status(201).json(preset);
    } catch (error) {
      console.error("Error creating filter preset:", error);
      res.status(500).json({ message: "Failed to create filter preset" });
    }
  });

  app.put("/api/filter-presets/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const preset = await storage.updateFilterPreset(req.params.id, req.authUser.tenantId, req.authUser.id, req.body);
      if (!preset) {
        return res.status(404).json({ message: "Filter preset not found" });
      }

      res.json(preset);
    } catch (error) {
      console.error("Error updating filter preset:", error);
      res.status(500).json({ message: "Failed to update filter preset" });
    }
  });

  app.delete("/api/filter-presets/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteFilterPreset(req.params.id, req.authUser.tenantId, req.authUser.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting filter preset:", error);
      res.status(500).json({ message: "Failed to delete filter preset" });
    }
  });

  // Get client by CPF endpoint
  app.get("/api/clients/cpf/:cpf", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { cpf } = req.params;
      const client = await storage.getClientByCPF(req.authUser.tenantId, cpf);
      
      if (client) {
        res.json(client);
      } else {
        res.status(404).json({ message: "Client not found" });
      }
    } catch (error) {
      console.error("Error fetching client by CPF:", error);
      res.status(500).json({ message: "Failed to fetch client by CPF" });
    }
  });

  // Create client endpoint
  app.post("/api/clients", isAuthenticated, requirePermission(PERMISSIONS.CLIENTS_CREATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const clientData = { ...req.body, tenantId: req.authUser.tenantId };
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Update client endpoint
  app.put("/api/clients/:clientId", isAuthenticated, requirePermission(PERMISSIONS.CLIENTS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { clientId } = req.params;
      const client = await storage.updateClient(clientId, req.body, req.authUser.tenantId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // Delete client endpoint
  app.delete("/api/clients/:clientId", isAuthenticated, requirePermission(PERMISSIONS.CLIENTS_DELETE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { clientId } = req.params;
      
      // Check if client has any tickets
      const clientTickets = await storage.getTicketsByClientId(clientId, req.authUser.tenantId);
      if (clientTickets.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete client with existing tickets. Please delete or reassign tickets first.",
          ticketCount: clientTickets.length
        });
      }

      await storage.deleteClient(clientId, req.authUser.tenantId);
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Get client tickets with summary info
  app.get("/api/clients/:clientId/tickets", isAuthenticated, requirePermission(PERMISSIONS.CLIENTS_READ), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { clientId } = req.params;
      const tickets = await storage.getTicketsByClientId(clientId, req.authUser.tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching client tickets:", error);
      res.status(500).json({ message: "Failed to fetch client tickets" });
    }
  });

  app.post("/api/localizations", isAuthenticated, async (req: any, res) => {
    try {
      const { key, language, value } = req.body;
      
      if (!key || !language || !value) {
        return res.status(400).json({ message: "Key, language, and value are required" });
      }

      const localization = await storage.createLocalization({ key, language, value });
      res.json(localization);
    } catch (error) {
      console.error("Error creating localization:", error);
      res.status(500).json({ message: "Failed to create localization" });
    }
  });

  app.put("/api/localizations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { key, language, value } = req.body;
      
      const localization = await storage.updateLocalization(id, { key, language, value });
      
      if (!localization) {
        return res.status(404).json({ message: "Localization not found" });
      }

      res.json(localization);
    } catch (error) {
      console.error("Error updating localization:", error);
      res.status(500).json({ message: "Failed to update localization" });
    }
  });

  // Get localizations by key for all languages
  app.get("/api/localizations/key/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const localizations = await storage.getLocalizationsByKey(key);
      res.json(localizations);
    } catch (error) {
      console.error("Error fetching localizations by key:", error);
      res.status(500).json({ message: "Failed to fetch localizations by key" });
    }
  });

  // Get all auto-generated lists for management
  app.get("/api/auto-gen-lists", isAuthenticated, async (req: any, res) => {
    try {
      const lists = await storage.getAllAutoGenLists();
      res.json(lists);
    } catch (error) {
      console.error("Error fetching auto-gen lists:", error);
      res.status(500).json({ message: "Failed to fetch auto-gen lists" });
    }
  });

  // Auto-generated lists routes (device brands)
  app.get("/api/auto-gen-lists/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const list = await storage.getAutoGenList(category);
      
      if (!list) {
        return res.status(404).json({ message: "Auto-generated list not found for this category" });
      }

      res.json(list);
    } catch (error) {
      console.error("Error fetching auto-generated list:", error);
      res.status(500).json({ message: "Failed to fetch auto-generated list" });
    }
  });

  // Initialize brand lists if they don't exist
  app.post("/api/auto-gen-lists/initialize", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("Initializing auto-generated brand lists...");
      await aiService.generateAllDeviceBrandLists();
      
      res.json({ message: "Auto-generated lists initialized successfully" });
    } catch (error) {
      console.error("Error initializing auto-generated lists:", error);
      res.status(500).json({ message: "Failed to initialize auto-generated lists" });
    }
  });

  // Force update specific category
  app.post("/api/auto-gen-lists/:category/update", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { category } = req.params;
      console.log(`Force updating brand list for ${category}...`);
      const { brands } = await aiService.generateDeviceBrands(category);
      
      const existingList = await storage.getAutoGenList(category);
      if (existingList) {
        await storage.updateAutoGenList(existingList.id, {
          items: brands,
          lastGenerated: new Date(),
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          updatedAt: new Date()
        });
      } else {
        await storage.createAutoGenList({
          listType: `AutoGen-List-Brands-${category}`,
          category,
          items: brands,
          lastGenerated: new Date(),
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          isActive: true
        });
      }

      res.json({ message: `Brand list for ${category} updated successfully`, brands: brands.length });
    } catch (error) {
      console.error(`Error updating brand list for ${req.params.category}:`, error);
      res.status(500).json({ message: "Failed to update brand list" });
    }
  });

  // Validate and add new brand
  app.post("/api/auto-gen-lists/:category/validate-brand", async (req, res) => {
    try {
      const { category } = req.params;
      const { brandName } = req.body;
      
      if (!brandName || typeof brandName !== 'string') {
        return res.status(400).json({ message: "Brand name is required" });
      }

      console.log(`💰 Brand validation request for "${brandName}" in ${category} category`);
      const result = await aiService.validateAndAddBrand(category, brandName);
      
      res.json(result);
    } catch (error) {
      console.error("Error validating brand:", error);
      res.status(500).json({ message: "Failed to validate brand" });
    }
  });

  app.post("/api/auto-gen-lists/:category/:brand/validate-model", async (req, res) => {
    try {
      const { category, brand } = req.params;
      const { modelName } = req.body;
      
      if (!modelName || typeof modelName !== 'string') {
        return res.status(400).json({ message: "Model name is required" });
      }

      console.log(`💰 Model validation request for "${modelName}" in ${brand} ${category} category`);
      const result = await aiService.validateAndAddModel(category, brand, modelName);
      
      res.json(result);
    } catch (error) {
      console.error("Error validating model:", error);
      res.status(500).json({ message: "Failed to validate model" });
    }
  });

  // Device colors route - Get available colors for a specific device
  app.get("/api/device-colors/:deviceType/:brand/:model", async (req, res) => {
    try {
      const { deviceType, brand, model } = req.params;
      
      if (!deviceType || !brand || !model) {
        return res.status(400).json({ message: "Device type, brand, and model are required" });
      }

      console.log(`🎨 Color lookup request for ${brand} ${model} (${deviceType})`);
      const result = await deviceColorService.getDeviceColors(deviceType, brand, model);
      
      res.json({
        colors: result.colors,
        fromCache: result.fromCache,
        fallback: false
      });
    } catch (error) {
      console.error("Error fetching device colors:", error);
      res.status(500).json({ 
        message: "Failed to fetch device colors",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save custom device color - Add a user-submitted color to the database
  app.post("/api/device-colors/:deviceType/:brand/:model/add-color", async (req, res) => {
    try {
      const { deviceType, brand, model } = req.params;
      const { color } = req.body;
      
      if (!deviceType || !brand || !model || !color) {
        return res.status(400).json({ message: "Device type, brand, model, and color are required" });
      }

      if (typeof color !== 'string' || color.trim().length === 0) {
        return res.status(400).json({ message: "Color must be a non-empty string" });
      }

      const trimmedColor = color.trim();
      console.log(`🎨 Adding custom color "${trimmedColor}" to ${brand} ${model} (${deviceType})`);

      // First check if device exists in auto-gen lists
      const listType = `AutoGen-List-Models-${deviceType}-${brand}`;
      const autoGenList = await storage.getAutoGenListByType(listType);
      
      if (!autoGenList || !autoGenList.items) {
        return res.status(404).json({ 
          message: `Device brand ${brand} not found in ${deviceType} auto-gen lists` 
        });
      }
      
      const modelExists = autoGenList.items.some(item => 
        item.toLowerCase() === model.toLowerCase()
      );
      
      if (!modelExists) {
        return res.status(404).json({ 
          message: `Model ${model} not found in ${brand} ${deviceType} auto-gen lists` 
        });
      }

      console.log(`✅ Device ${brand} ${model} (${deviceType}) exists in auto-gen lists`);

      // Check if device colors entry exists
      const deviceColor = await storage.getDeviceColors(deviceType, brand, model);
      
      if (deviceColor) {
        // Check if color already exists (case-insensitive)
        const existingColors = deviceColor.colors.map(c => c.toLowerCase());
        if (existingColors.includes(trimmedColor.toLowerCase())) {
          return res.json({
            success: true,
            message: "Color already exists",
            colors: deviceColor.colors
          });
        }

        // Add new color to existing list
        const updatedColors = [...deviceColor.colors, trimmedColor];
        const updated = await storage.updateDeviceColors(deviceType, brand, model, updatedColors, 'user_contributed');
        
        if (updated) {
          console.log(`✅ Added custom color "${trimmedColor}" to existing ${brand} ${model}`);
          return res.json({
            success: true,
            message: "Color added successfully",
            colors: updated.colors
          });
        }
      } else {
        // Create new device color entry with the custom color
        const newDeviceColor = await storage.createDeviceColor({
          deviceType,
          brand,
          model,
          colors: [trimmedColor],
          source: 'user_contributed'
        });
        
        console.log(`✅ Created new device color entry for ${brand} ${model} with color "${trimmedColor}"`);
        return res.json({
          success: true,
          message: "Device and color added successfully",
          colors: newDeviceColor.colors
        });
      }

      res.status(500).json({ message: "Failed to save color" });
    } catch (error) {
      console.error("Error saving custom device color:", error);
      res.status(500).json({ 
        message: "Failed to save custom color",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoint to test auto-gen lists retrieval
  app.get("/api/debug/auto-gen-lists", async (req, res) => {
    try {
      console.log("🔍 Debug: Starting auto-gen lists test...");
      const allLists = await storage.getAllAutoGenLists();
      console.log(`🔍 Debug: Found ${allLists.length} auto-gen lists`);
      
      const modelLists = allLists.filter(list => 
        list.listType?.includes('Models-') && 
        list.isActive && 
        list.brand && 
        list.items && 
        list.items.length > 0
      );
      
      const sample = allLists.slice(0, 5).map(l => ({
        listType: l.listType,
        brand: l.brand,
        is_active: l.isActive,
        item_count: l.items?.length || 0
      }));
      
      res.json({
        total: allLists.length,
        modelLists: modelLists.length,
        sample
      });
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Bulk populate device colors for all auto-gen list devices
  app.post("/api/device-colors/bulk-populate", async (req, res) => {
    try {
      console.log("🎨 Starting bulk population of device colors...");

      // Get all active auto-gen lists for models (not brands)
      const allLists = await storage.getAllAutoGenLists();
      console.log(`🔍 Found ${allLists.length} total auto-gen lists`);
      
      if (allLists.length === 0) {
        return res.json({
          success: true,
          message: "No auto-gen lists found to process",
          summary: {
            totalDevicesProcessed: 0,
            totalColorsAdded: 0,
            skippedExisting: 0,
            categoriesProcessed: 0
          },
          results: []
        });
      }
      
      const modelLists = allLists.filter(list => 
        list.listType?.includes('Models-') && 
        list.isActive && 
        list.brand && 
        list.items && 
        list.items.length > 0
      );

      console.log(`📋 Found ${modelLists.length} model lists to process`);
      console.log('📝 Sample model lists:', modelLists.slice(0, 3).map(l => ({
        listType: l.listType,
        brand: l.brand,
        isActive: l.isActive,
        item_count: l.items?.length || 0
      })));

      let totalDevicesProcessed = 0;
      let totalColorsAdded = 0;
      let skippedExisting = 0;
      
      const results = [];

      for (const list of modelLists) {
        // Extract category and brand from list type
        // Format: AutoGen-List-Models-{Category}-{Brand}
        const parts = list.listType!.split('-');
        if (parts.length < 4) continue;
        
        const category = parts[3]; // Phone, Laptop, Desktop
        const brand = list.brand!;
        
        console.log(`\n🔄 Processing ${brand} ${category} models (${list.items!.length} models)...`);
        
        let categoryResults = {
          category,
          brand,
          processed: 0,
          colorsAdded: 0,
          skipped: 0,
          errors: [] as string[]
        };

        for (const model of list.items!) {
          try {
            totalDevicesProcessed++;
            
            // Check if this device already has colors
            const existingColors = await storage.getDeviceColors(category, brand, model);
            
            if (existingColors && existingColors.colors.length > 0) {
              skippedExisting++;
              categoryResults.skipped++;
              continue;
            }

            // Get colors using the device color service
            const colorResult = await deviceColorService.getDeviceColors(category, brand, model);
            
            if (colorResult.colors && colorResult.colors.length > 0) {
              totalColorsAdded++;
              categoryResults.colorsAdded++;
              console.log(`  ✅ Added ${colorResult.colors.length} colors for ${brand} ${model}`);
            } else {
              // Don't add fallback colors during bulk population - let API be called naturally when needed
              console.log(`  ⏸️ No colors available for ${brand} ${model} - will be populated on demand`);
              categoryResults.skipped++;
            }
            
            categoryResults.processed++;
            
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  ❌ Error processing ${brand} ${model}:`, errorMsg);
            categoryResults.errors.push(`${model}: ${errorMsg}`);
          }
        }
        
        results.push(categoryResults);
        console.log(`✅ Completed ${brand} ${category}: ${categoryResults.processed} processed, ${categoryResults.colorsAdded} colors added, ${categoryResults.skipped} skipped`);
      }

      console.log(`\n🎉 Bulk population complete!`);
      console.log(`📊 Total devices processed: ${totalDevicesProcessed}`);
      console.log(`🎨 Total colors added: ${totalColorsAdded}`);
      console.log(`⏭️ Skipped existing: ${skippedExisting}`);

      res.json({
        success: true,
        message: "Bulk population completed",
        summary: {
          totalDevicesProcessed,
          totalColorsAdded,
          skippedExisting,
          categoriesProcessed: results.length
        },
        results
      });

    } catch (error) {
      console.error("Error during bulk population:", error);
      res.status(500).json({ 
        message: "Bulk population failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Populate laptop and phone colors specifically
  app.post("/api/device-colors/populate-laptops-phones", async (req, res) => {
    try {
      console.log("🎨 Starting laptop and phone color population...");

      const allLists = await storage.getAllAutoGenLists();
      const laptopAndPhoneLists = allLists.filter(list => 
        (list.listType?.includes('Models-Laptop-') || list.listType?.includes('Models-Phone-')) &&
        list.isActive && 
        list.brand && 
        list.items && 
        list.items.length > 0
      );

      console.log(`📋 Found ${laptopAndPhoneLists.length} laptop and phone model lists to process`);

      let totalDevicesProcessed = 0;
      let totalColorsAdded = 0;
      let skippedExisting = 0;
      const results = [];

      for (const list of laptopAndPhoneLists) {
        const parts = list.listType!.split('-');
        if (parts.length < 4) continue;
        
        const category = parts[3]; // Laptop or Phone
        const brand = list.brand!;
        
        console.log(`\n🔄 Processing ${brand} ${category} models (${list.items!.length} models)...`);
        
        let categoryResults = {
          category,
          brand,
          processed: 0,
          colorsAdded: 0,
          skipped: 0,
          errors: [] as string[]
        };

        for (const model of list.items!) {
          try {
            totalDevicesProcessed++;
            
            // Check if this device already has colors
            const existingColors = await storage.getDeviceColors(category, brand, model);
            
            if (existingColors && existingColors.colors.length > 0) {
              skippedExisting++;
              categoryResults.skipped++;
              continue;
            }

            // Get colors using the device color service
            const colorResult = await deviceColorService.getDeviceColors(category, brand, model);
            
            if (colorResult.colors && colorResult.colors.length > 0) {
              totalColorsAdded++;
              categoryResults.colorsAdded++;
              console.log(`  ✅ Added ${colorResult.colors.length} colors for ${brand} ${model}`);
            } else {
              // Don't add fallback colors during bulk population - let API be called naturally when needed
              console.log(`  ⏸️ No colors available for ${brand} ${model} - will be populated on demand`);
              categoryResults.skipped++;
            }
            
            categoryResults.processed++;
            
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  ❌ Error processing ${brand} ${model}:`, errorMsg);
            categoryResults.errors.push(`${model}: ${errorMsg}`);
          }
        }
        
        results.push(categoryResults);
        console.log(`✅ Completed ${brand} ${category}: ${categoryResults.processed} processed, ${categoryResults.colorsAdded} colors added, ${categoryResults.skipped} skipped`);
      }

      console.log(`\n🎉 Laptop and phone population complete!`);
      console.log(`📊 Total devices processed: ${totalDevicesProcessed}`);
      console.log(`🎨 Total colors added: ${totalColorsAdded}`);
      console.log(`⏭️ Skipped existing: ${skippedExisting}`);

      res.json({
        success: true,
        message: "Laptop and phone population completed",
        summary: {
          totalDevicesProcessed,
          totalColorsAdded,
          skippedExisting,
          categoriesProcessed: results.length
        },
        results
      });

    } catch (error) {
      console.error("Error during laptop and phone population:", error);
      res.status(500).json({ 
        message: "Laptop and phone population failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Model list routes - Get models for a specific brand and category
  app.get("/api/auto-gen-lists/:category/:brand/models", async (req, res) => {
    try {
      const { category, brand } = req.params;
      const listType = `AutoGen-List-Models-${category}-${brand}`;
      
      const list = await storage.getAutoGenListByType(listType);
      
      if (!list) {
        return res.status(404).json({ message: "Model list not found for this brand and category" });
      }

      res.json(list);
    } catch (error) {
      console.error("Error fetching model list:", error);
      res.status(500).json({ message: "Failed to fetch model list" });
    }
  });

  // Generate model lists for all brands of a specific category
  app.post("/api/auto-gen-lists/:category/generate-models", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { category } = req.params;

      // Check if generation is already in progress
      const existingStatus = aiService.getGenerationStatus(category) as any;
      if (existingStatus && existingStatus.status === 'running') {
        return res.status(409).json({ 
          message: `Generation already in progress for ${category}`,
          status: existingStatus
        });
      }

      console.log(`⚠️  COST WARNING: Generating model lists for ${category} - this will make multiple OpenAI API calls`);
      
      // Start generation asynchronously for better responsiveness
      aiService.generateAllDeviceModelLists(category).catch(error => {
        console.error(`Async generation failed for ${category}:`, error);
      });
      
      res.json({ 
        message: `Model generation started for ${category}. This may take 2-3 minutes to complete.`,
        statusEndpoint: `/api/auto-gen-lists/${category}/status`,
        isAsync: true,
        estimatedTime: "2-3 minutes"
      });
    } catch (error) {
      console.error(`Error starting model generation for ${req.params.category}:`, error);
      
      // Reset generation status on error
      aiService.resetGenerationStatus(req.params.category);
      
      res.status(500).json({ 
        message: "Failed to start model generation. Please try again.", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Generate models for a specific brand and category
  app.post("/api/auto-gen-lists/:category/:brand/generate-models", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { category, brand } = req.params;
      console.log(`💰 Making OpenAI API call for ${brand} ${category} models...`);
      const { models } = await aiService.generateDeviceModels(category, brand);
      
      // Check if model list already exists for this brand
      const listType = `AutoGen-List-Models-${category}-${brand}`;
      const existingList = await storage.getAutoGenListByType(listType);
      
      if (existingList) {
        // Update existing list
        await storage.updateAutoGenList(existingList.id, {
          items: models,
          lastGenerated: new Date(),
          nextUpdate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now (quarterly)
          updatedAt: new Date()
        });
      } else {
        // Create new list
        await storage.createAutoGenList({
          listType,
          category,
          brand,
          items: models,
          lastGenerated: new Date(),
          nextUpdate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          refreshInterval: 'quarterly',
          isActive: true
        });
      }

      res.json({ message: `Model list for ${brand} ${category} updated successfully`, models: models.length });
    } catch (error) {
      console.error(`Error generating model list for ${req.params.brand} ${req.params.category}:`, error);
      res.status(500).json({ message: "Failed to generate model list" });
    }
  });

  // Get generation status for monitoring
  app.get("/api/auto-gen-lists/status", isAuthenticated, async (req: any, res) => {
    try {
      const statuses = aiService.getGenerationStatus();
      res.json({ statuses });
    } catch (error) {
      console.error("Error fetching generation status:", error);
      res.status(500).json({ message: "Failed to fetch generation status" });
    }
  });

  // Get specific device type generation status
  app.get("/api/auto-gen-lists/:category/status", isAuthenticated, async (req: any, res) => {
    try {
      const { category } = req.params;
      const status = aiService.getGenerationStatus(category);
      
      if (!status) {
        return res.json({ status: 'idle', message: 'No generation in progress' });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching generation status:", error);
      res.status(500).json({ message: "Failed to fetch generation status" });
    }
  });

  // Cancel stuck generation process
  app.post("/api/auto-gen-lists/:category/cancel", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { category } = req.params;
      const cancelled = aiService.cancelGeneration(category);
      
      if (cancelled) {
        res.json({ message: `Generation cancelled for ${category}` });
      } else {
        res.json({ message: `No active generation found for ${category}` });
      }
    } catch (error) {
      console.error("Error cancelling generation:", error);
      res.status(500).json({ message: "Failed to cancel generation" });
    }
  });

  // Reset generation status for recovery
  app.post("/api/auto-gen-lists/:category/reset", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { category } = req.params;
      aiService.resetGenerationStatus(category);
      res.json({ message: `Generation status reset for ${category}` });
    } catch (error) {
      console.error("Error resetting generation status:", error);
      res.status(500).json({ message: "Failed to reset generation status" });
    }
  });

  // Emergency reset all generations
  app.post("/api/auto-gen-lists/reset-all", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const cancelledCount = aiService.cancelAllGenerations();
      res.json({ 
        message: `Emergency reset completed. Cancelled ${cancelledCount} running generations.`,
        cancelled: cancelledCount
      });
    } catch (error) {
      console.error("Error performing emergency reset:", error);
      res.status(500).json({ message: "Failed to perform emergency reset" });
    }
  });

  // Retry failed brands for a specific category
  app.post("/api/auto-gen-lists/:category/retry", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { category } = req.params;
      console.log(`⚠️  COST WARNING: User ${req.authUser.id} is retrying failed brands for ${category}`);
      
      // Start retry process asynchronously
      aiService.retryFailedBrands(category).catch(error => {
        console.error(`Async retry failed for ${category}:`, error);
      });
      
      res.json({ 
        message: `Retry started for failed brands in ${category}. Check status endpoint for progress.`,
        statusEndpoint: `/api/auto-gen-lists/${category}/status`,
        isAsync: true
      });
    } catch (error) {
      console.error(`Error starting retry for ${req.params.category}:`, error);
      res.status(500).json({ message: (error as Error).message || "Failed to start retry" });
    }
  });

  // Device Checklist Templates endpoint
  app.get("/api/device-checklist-templates/:deviceType", async (req, res) => {
    try {
      const { deviceType } = req.params;
      
      if (!deviceType) {
        return res.status(400).json({ message: "Device type is required" });
      }

      const template = await storage.getDeviceChecklistTemplate(deviceType);
      
      if (!template) {
        // Return fallback template for unknown device types
        return res.json({
          deviceType,
          components: ["Overall Condition", "Power Button", "Charging Port", "Screen/Display"],
          fallback: true
        });
      }

      res.json({
        deviceType: template.deviceType,
        components: template.components,
        fallback: false
      });
    } catch (error) {
      console.error("Error fetching device checklist template:", error);
      res.status(500).json({ 
        message: "Failed to fetch device checklist template",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Initialize device checklist templates
  app.post("/api/device-checklist-templates/init", async (req, res) => {
    try {
      console.log("🔧 Initializing device checklist templates...");
      
      const templates = [
        {
          deviceType: "Phone",
          components: [
            "Overall Physical Condition",
            "Screen Condition", 
            "Home Button",
            "Volume Buttons",
            "Power Button",
            "Charging Port",
            "Headphone Jack",
            "Speaker",
            "Microphone",
            "Camera (Front)",
            "Camera (Rear)",
            "Flash",
            "Fingerprint Sensor",
            "SIM Tray",
            "Back Cover",
            "Battery Status",
            "Water Damage Indicators"
          ]
        },
        {
          deviceType: "Laptop", 
          components: [
            "Overall Physical Condition",
            "Screen Condition",
            "Keyboard",
            "Trackpad",
            "Power Button", 
            "Charging Port",
            "USB Ports",
            "HDMI Port",
            "Audio Jack",
            "Speakers",
            "Microphone",
            "Webcam",
            "Hinges",
            "Battery Status",
            "Hard Drive/SSD",
            "RAM",
            "Fan/Cooling System",
            "Wi-Fi Card"
          ]
        },
        {
          deviceType: "Desktop",
          components: [
            "Overall Physical Condition",
            "Power Button",
            "Power Supply",
            "Motherboard", 
            "CPU",
            "RAM",
            "Hard Drive/SSD",
            "Graphics Card",
            "Front USB Ports",
            "Rear USB Ports", 
            "Audio Ports",
            "Ethernet Port",
            "HDMI/Display Ports",
            "Optical Drive",
            "Case Fans",
            "Cable Management",
            "BIOS/UEFI"
          ]
        },
        {
          deviceType: "Tablet",
          components: [
            "Overall Physical Condition",
            "Screen Condition",
            "Home Button",
            "Volume Buttons", 
            "Power Button",
            "Charging Port",
            "Headphone Jack",
            "Speaker",
            "Microphone",
            "Front Camera",
            "Rear Camera",
            "Fingerprint Sensor",
            "Back Cover",
            "Battery Status",
            "Water Damage Indicators"
          ]
        }
      ];

      let created = 0;
      let updated = 0;

      for (const template of templates) {
        const existing = await storage.getDeviceChecklistTemplate(template.deviceType);
        
        if (existing) {
          // Update existing template
          await storage.updateDeviceChecklistTemplate(template.deviceType, template.components);
          updated++;
          console.log(`📝 Updated template for ${template.deviceType}`);
        } else {
          // Create new template
          await storage.createDeviceChecklistTemplate(template);
          created++;
          console.log(`✅ Created template for ${template.deviceType} with ${template.components.length} components`);
        }
      }

      console.log(`🎉 Checklist templates initialization complete: ${created} created, ${updated} updated`);
      
      res.json({
        success: true,
        message: `Checklist templates initialized successfully`,
        summary: {
          created,
          updated,
          total: templates.length
        }
      });

    } catch (error) {
      console.error("Error initializing device checklist templates:", error);
      res.status(500).json({ 
        message: "Failed to initialize device checklist templates",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Issue Assessment routes - device-specific diagnostic questions
  app.get("/api/issue-questions/:deviceType", async (req, res) => {
    try {
      const { deviceType } = req.params;
      
      if (!['Phone', 'Laptop', 'Desktop'].includes(deviceType)) {
        return res.status(400).json({ message: "Invalid device type. Must be Phone, Laptop, or Desktop" });
      }

      const questions = await storage.getIssueQuestions(deviceType);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching issue questions:", error);
      res.status(500).json({ message: "Failed to fetch issue questions" });
    }
  });

  app.post("/api/issue-responses", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId, responses } = req.body;
      
      if (!ticketId || !responses || !Array.isArray(responses)) {
        return res.status(400).json({ message: "ticketId and responses array are required" });
      }

      // Verify ticket belongs to user's tenant
      const ticket = await storage.getTicket(ticketId, req.authUser.tenantId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Save all responses
      const savedResponses = [];
      for (const response of responses) {
        const saved = await storage.createIssueResponse({
          ticketId,
          questionId: response.questionId,
          response: JSON.stringify(response.answer)
        });
        savedResponses.push(saved);
      }

      res.json({ 
        message: "Issue assessment saved successfully",
        responses: savedResponses
      });
    } catch (error) {
      console.error("Error saving issue responses:", error);
      res.status(500).json({ message: "Failed to save issue responses" });
    }
  });

  app.get("/api/issue-responses/:ticketId", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { ticketId } = req.params;

      // Verify ticket belongs to user's tenant
      const ticket = await storage.getTicket(ticketId, req.authUser.tenantId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      const responses = await storage.getIssueResponses(ticketId);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching issue responses:", error);
      res.status(500).json({ message: "Failed to fetch issue responses" });
    }
  });

  // Store settings API endpoints
  // GET store settings - accessible to all authenticated users (for shop name/logo display)
  app.get("/api/store-settings", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const settings = await storage.getStoreSettings(req.authUser.tenantId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching store settings:", error);
      res.status(500).json({ message: "Failed to fetch store settings" });
    }
  });

  app.post("/api/store-settings", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const settings = await storage.createStoreSettings({
        tenantId: req.authUser.tenantId,
        ...req.body
      });
      res.json(settings);
    } catch (error) {
      console.error("Error creating store settings:", error);
      res.status(500).json({ message: "Failed to create store settings" });
    }
  });

  app.put("/api/store-settings", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const settings = await storage.updateStoreSettings(req.authUser.tenantId, req.body);
      if (!settings) {
        return res.status(404).json({ message: "Store settings not found" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error updating store settings:", error);
      res.status(500).json({ message: "Failed to update store settings" });
    }
  });

  // Warranty tiers API endpoints
  app.get("/api/warranty-tiers", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tiers = await storage.getWarrantyTiers(req.authUser.tenantId);
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching warranty tiers:", error);
      res.status(500).json({ message: "Failed to fetch warranty tiers" });
    }
  });

  app.get("/api/warranty-tiers/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { deviceType } = req.params;
      const tiers = await storage.getWarrantyTiersByDeviceType(req.authUser.tenantId, deviceType);
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching warranty tiers for device type:", error);
      res.status(500).json({ message: "Failed to fetch warranty tiers for device type" });
    }
  });

  app.post("/api/warranty-tiers", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tier = await storage.createWarrantyTier({
        tenantId: req.authUser.tenantId,
        ...req.body
      });
      res.json(tier);
    } catch (error) {
      console.error("Error creating warranty tier:", error);
      res.status(500).json({ message: "Failed to create warranty tier" });
    }
  });

  app.put("/api/warranty-tiers/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const tier = await storage.updateWarrantyTier(id, req.authUser.tenantId, req.body);
      if (!tier) {
        return res.status(404).json({ message: "Warranty tier not found" });
      }
      res.json(tier);
    } catch (error) {
      console.error("Error updating warranty tier:", error);
      res.status(500).json({ message: "Failed to update warranty tier" });
    }
  });

  app.delete("/api/warranty-tiers/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const success = await storage.deleteWarrantyTier(id, req.authUser.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Warranty tier not found" });
      }
      res.json({ message: "Warranty tier deleted successfully" });
    } catch (error) {
      console.error("Error deleting warranty tier:", error);
      res.status(500).json({ message: "Failed to delete warranty tier" });
    }
  });

  // Repair services routes
  app.get("/api/repair-services", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const services = await storage.getRepairServices(req.authUser.tenantId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching repair services:", error);
      res.status(500).json({ message: "Failed to fetch repair services" });
    }
  });

  app.get("/api/repair-services/device/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { deviceType } = req.params;
      const services = await storage.getRepairServicesByDeviceType(req.authUser.tenantId, deviceType);
      res.json(services);
    } catch (error) {
      console.error("Error fetching repair services by device type:", error);
      res.status(500).json({ message: "Failed to fetch repair services" });
    }
  });

  app.post("/api/repair-services", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const service = await storage.createRepairService({
        tenantId: req.authUser.tenantId,
        ...req.body
      });
      res.json(service);
    } catch (error) {
      console.error("Error creating repair service:", error);
      res.status(500).json({ message: "Failed to create repair service" });
    }
  });

  app.put("/api/repair-services/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const service = await storage.updateRepairService(id, req.authUser.tenantId, req.body);
      if (!service) {
        return res.status(404).json({ message: "Repair service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating repair service:", error);
      res.status(500).json({ message: "Failed to update repair service" });
    }
  });

  app.delete("/api/repair-services/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const success = await storage.deleteRepairService(id, req.authUser.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Repair service not found" });
      }
      res.json({ message: "Repair service deleted successfully" });
    } catch (error) {
      console.error("Error deleting repair service:", error);
      res.status(500).json({ message: "Failed to delete repair service" });
    }
  });

  // Possible defects routes
  app.get("/api/possible-defects", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const defects = await storage.getPossibleDefects(req.authUser.tenantId);
      res.json(defects);
    } catch (error) {
      console.error("Error fetching possible defects:", error);
      res.status(500).json({ message: "Failed to fetch possible defects" });
    }
  });

  app.get("/api/possible-defects/device/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { deviceType } = req.params;
      if (!deviceType || deviceType.trim() === '') {
        return res.status(400).json({ message: "Device type is required" });
      }

      // Get tenant-specific defects for this device type
      const defects = await storage.getPossibleDefectsByDeviceType(req.authUser.tenantId, deviceType);
      
      // Sort alphabetically to ensure consistent ordering
      const sortedDefects = defects.sort((a, b) => a.name.localeCompare(b.name));
      
      res.json(sortedDefects);
    } catch (error) {
      console.error("Error fetching possible defects by device type:", error);
      res.status(500).json({ message: "Failed to fetch possible defects" });
    }
  });

  app.post("/api/possible-defects", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const defect = await storage.createPossibleDefect({
        tenantId: req.authUser.tenantId,
        ...req.body
      });
      res.json(defect);
    } catch (error) {
      console.error("Error creating possible defect:", error);
      res.status(500).json({ message: "Failed to create possible defect" });
    }
  });

  app.put("/api/possible-defects/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const defect = await storage.updatePossibleDefect(id, req.authUser.tenantId, req.body);
      if (!defect) {
        return res.status(404).json({ message: "Possible defect not found" });
      }
      res.json(defect);
    } catch (error) {
      console.error("Error updating possible defect:", error);
      res.status(500).json({ message: "Failed to update possible defect" });
    }
  });

  app.delete("/api/possible-defects/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const success = await storage.deletePossibleDefect(id, req.authUser.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Possible defect not found" });
      }
      res.json({ message: "Possible defect deleted successfully" });
    } catch (error) {
      console.error("Error deleting possible defect:", error);
      res.status(500).json({ message: "Failed to delete possible defect" });
    }
  });

  // Checklists routes
  app.get("/api/checklists", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const checklists = await storage.getChecklists(req.authUser.tenantId);
      res.json(checklists);
    } catch (error) {
      console.error("Error fetching checklists:", error);
      res.status(500).json({ message: "Failed to fetch checklists" });
    }
  });

  app.get("/api/checklists/device/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { deviceType } = req.params;
      if (!deviceType || deviceType.trim() === '') {
        return res.status(400).json({ message: "Device type is required" });
      }

      const checklists = await storage.getChecklistsByDeviceType(req.authUser.tenantId, deviceType);
      res.json(checklists);
    } catch (error) {
      console.error("Error fetching checklists by device type:", error);
      res.status(500).json({ message: "Failed to fetch checklists by device type" });
    }
  });

  // Initialize default checklists for current tenant (for existing tenants)
  app.post("/api/checklists/initialize", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(`🔧 Initializing default checklists for tenant: ${req.authUser.tenantId}`);
      await storage.initializeDefaultChecklists(req.authUser.tenantId);
      
      res.json({ message: "Default checklists initialized successfully" });
    } catch (error) {
      console.error("Error initializing default checklists:", error);
      res.status(500).json({ message: "Failed to initialize default checklists" });
    }
  });

  app.post("/api/checklists", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body using Zod schema
      const validationResult = insertChecklistSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid checklist data", 
          errors: validationResult.error.errors 
        });
      }

      const { tenantId, ...checklistData } = validationResult.data;
      const checklist = await storage.createChecklist({
        tenantId: req.authUser.tenantId,
        ...checklistData
      });
      res.status(201).json(checklist);
    } catch (error) {
      console.error("Error creating checklist:", error);
      res.status(500).json({ message: "Failed to create checklist" });
    }
  });

  app.put("/api/checklists/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      // Validate request body using Zod schema (partial for updates)
      const validationResult = insertChecklistSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid checklist data", 
          errors: validationResult.error.errors 
        });
      }

      const checklist = await storage.updateChecklist(id, req.authUser.tenantId, validationResult.data);
      if (!checklist) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.json(checklist);
    } catch (error) {
      console.error("Error updating checklist:", error);
      res.status(500).json({ message: "Failed to update checklist" });
    }
  });

  app.delete("/api/checklists/:id", isAuthenticated, requirePermission(PERMISSIONS.SETTINGS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const success = await storage.deleteChecklist(id, req.authUser.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.json({ message: "Checklist deleted successfully" });
    } catch (error) {
      console.error("Error deleting checklist:", error);
      res.status(500).json({ message: "Failed to delete checklist" });
    }
  });

  // ==========================================================================
  // RBAC Routes - Groups Management
  // ==========================================================================

  // Get all groups for a tenant
  app.get("/api/groups", isAuthenticated, requirePermission(PERMISSIONS.GROUPS_READ), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const groups = await storage.getGroups(req.authUser.tenantId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Get a specific group
  app.get("/api/groups/:id", isAuthenticated, requirePermission(PERMISSIONS.GROUPS_READ), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const group = await storage.getGroup(id, req.authUser.tenantId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      res.json(group);
    } catch (error) {
      console.error("Error fetching group:", error);
      res.status(500).json({ message: "Failed to fetch group" });
    }
  });

  // Create a new group
  app.post("/api/groups", isAuthenticated, requirePermission(PERMISSIONS.GROUPS_CREATE), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, description, permissions, isDefault } = req.body;
      
      // Validate required fields
      if (!name || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ message: "Name and permissions array are required" });
      }

      const newGroup = await storage.createGroup({
        tenantId: req.authUser.tenantId,
        name,
        description: description || null,
        permissions,
        isDefault: isDefault || false,
        isSystemGroup: false,
      });

      res.status(201).json(newGroup);
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  // Update a group
  app.put("/api/groups/:id", isAuthenticated, requirePermission(PERMISSIONS.GROUPS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { name, description, permissions, isDefault } = req.body;

      const updatedGroup = await storage.updateGroup(id, req.authUser.tenantId, {
        name,
        description,
        permissions,
        isDefault,
      });

      if (!updatedGroup) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.json(updatedGroup);
    } catch (error) {
      console.error("Error updating group:", error);
      if (error instanceof Error && error.message.includes('does not belong to this tenant')) {
        return res.status(403).json({ message: "Unauthorized to modify this group" });
      }
      res.status(500).json({ message: "Failed to update group" });
    }
  });

  // Delete a group
  app.delete("/api/groups/:id", isAuthenticated, requirePermission(PERMISSIONS.GROUPS_DELETE), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const success = await storage.deleteGroup(id, req.authUser.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.json({ message: "Group deleted successfully" });
    } catch (error) {
      console.error("Error deleting group:", error);
      if (error instanceof Error && error.message.includes('does not belong to this tenant')) {
        return res.status(403).json({ message: "Unauthorized to delete this group" });
      }
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  // ==========================================================================
  // RBAC Routes - User-Group Management
  // ==========================================================================

  // Get groups for a specific user
  app.get("/api/users/:userId/groups", isAuthenticated, requirePermission(PERMISSIONS.USERS_MANAGE_GROUPS), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId: targetUserId } = req.params;
      const userGroups = await storage.getUserGroups(targetUserId, req.authUser.tenantId);
      res.json(userGroups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ message: "Failed to fetch user groups" });
    }
  });

  // Add user to a group
  app.post("/api/users/:userId/groups", isAuthenticated, requirePermission(PERMISSIONS.USERS_MANAGE_GROUPS), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId: targetUserId } = req.params;
      const { groupId } = req.body;

      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }

      const userGroup = await storage.addUserToGroup(targetUserId, groupId, req.authUser.tenantId);
      res.status(201).json(userGroup);
    } catch (error) {
      console.error("Error adding user to group:", error);
      if (error instanceof Error && error.message.includes('does not belong to this tenant')) {
        return res.status(403).json({ message: "Unauthorized: User or group does not belong to this tenant" });
      }
      res.status(500).json({ message: "Failed to add user to group" });
    }
  });

  // Remove user from a group
  app.delete("/api/users/:userId/groups/:groupId", isAuthenticated, requirePermission(PERMISSIONS.USERS_MANAGE_GROUPS), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId: targetUserId, groupId } = req.params;

      // Self-demotion guard: prevent users from removing themselves from their last admin group
      if (req.authUser.id === targetUserId) {
        const userGroups = await storage.getUserGroups(targetUserId, req.authUser.tenantId);
        const allGroups = await storage.getGroups(req.authUser.tenantId);
        
        // Check if user is removing themselves from an admin group
        const groupBeingRemoved = allGroups.find(g => g.id === groupId);
        if (groupBeingRemoved && Array.isArray(groupBeingRemoved.permissions)) {
          const hasUsersManageGroups = groupBeingRemoved.permissions.includes(PERMISSIONS.USERS_MANAGE_GROUPS);
          
          if (hasUsersManageGroups) {
            // Count how many admin groups the user is currently in
            const adminGroupCount = userGroups.filter(ug => {
              const group = allGroups.find(g => g.id === ug.groupId);
              return group && Array.isArray(group.permissions) && group.permissions.includes(PERMISSIONS.USERS_MANAGE_GROUPS);
            }).length;
            
            // Prevent removal if this is their last admin group
            if (adminGroupCount <= 1) {
              return res.status(403).json({ 
                message: "Cannot remove yourself from your last admin group. Please assign another admin first." 
              });
            }
          }
        }
      }

      const success = await storage.removeUserFromGroup(targetUserId, groupId, req.authUser.tenantId);
      if (!success) {
        return res.status(404).json({ message: "User-group association not found" });
      }

      res.json({ message: "User removed from group successfully" });
    } catch (error) {
      console.error("Error removing user from group:", error);
      if (error instanceof Error && error.message.includes('does not belong to this tenant')) {
        return res.status(403).json({ message: "Unauthorized: User or group does not belong to this tenant" });
      }
      res.status(500).json({ message: "Failed to remove user from group" });
    }
  });

  // Get user permissions (combined from all groups)
  app.get("/api/users/:userId/permissions", isAuthenticated, requirePermission(PERMISSIONS.USERS_READ), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId: targetUserId } = req.params;
      const permissions = await storage.getUserPermissions(targetUserId, req.authUser.tenantId);
      res.json({ permissions });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // ==========================================================================
  // RBAC Routes - User Invitations
  // ==========================================================================

  // Get all invitations for a tenant
  app.get("/api/invitations", isAuthenticated, requirePermission(PERMISSIONS.USERS_READ), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const invitations = await storage.getUserInvitations(req.authUser.tenantId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Create a new user with password (replaces email invitation flow)
  app.post("/api/invitations", isAuthenticated, requirePermission(PERMISSIONS.USERS_INVITE), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { email, firstName, lastName, phone, telegram, groupIds } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      // Check if invitation already exists
      const existingInvitation = await storage.getUserInvitationByEmail(email, req.authUser.tenantId);
      if (existingInvitation) {
        return res.status(400).json({ message: "An invitation for this email already exists" });
      }

      // Generate memorable password
      const { generateMemorablePassword, hashPassword } = await import('./utils/password.js');
      const temporaryPassword = generateMemorablePassword();
      const passwordHash = await hashPassword(temporaryPassword);

      // Generate unique token for backward compatibility
      const { nanoid } = await import('nanoid');
      const token = nanoid(32);
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create the invitation record (without storing plain-text password)
      const invitation = await storage.createUserInvitation({
        tenantId: req.authUser.tenantId,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        telegram: telegram || null,
        invitedByUserId: req.authUser.id,
        groupIds: groupIds || [],
        token,
        temporaryPassword: null, // Never store plain-text passwords
        expiresAt,
        status: 'accepted', // Immediately accepted since no email confirmation needed
      });

      // Create the user immediately
      const newUser = await storage.createUser({
        id: undefined,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        telegram: telegram || null,
        tenantId: req.authUser.tenantId,
        passwordHash,
        mustChangePassword: true,
        status: 'active',
        role: 'user',
      });

      // Assign groups
      if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
        await Promise.all(
          groupIds.map((groupId: string) =>
            storage.addUserToGroup(newUser.id, groupId, req.authUser.tenantId)
          )
        );
      }

      // Log the user creation
      await storage.createAuditLog({
        tenantId: req.authUser.tenantId,
        userId: req.authUser.id,
        action: 'create',
        resource: 'user',
        resourceId: newUser.id,
        details: { email, createdWithPassword: true },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json({ 
        ...invitation, 
        temporaryPassword, // Return password so admin can share it
        userId: newUser.id 
      });
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof Error && error.message.includes('does not belong to this tenant')) {
        return res.status(403).json({ message: "Unauthorized to create user" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Reset user password (Master/Admin only)
  app.post("/api/users/:userId/reset-password", isAuthenticated, requirePermission(PERMISSIONS.USERS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId } = req.params;

      // Get the target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify same tenant
      if (targetUser.tenantId !== req.authUser.tenantId) {
        return res.status(403).json({ message: "Unauthorized to reset password for this user" });
      }

      // Generate new memorable password
      const { generateMemorablePassword, hashPassword } = await import('./utils/password.js');
      const temporaryPassword = generateMemorablePassword();
      const passwordHash = await hashPassword(temporaryPassword);

      // Update user
      await storage.updateUser(userId, {
        passwordHash,
        mustChangePassword: true,
      });

      // Don't store plain-text password anywhere - only return it once

      // Log the password reset
      await storage.createAuditLog({
        tenantId: req.authUser.tenantId,
        userId: req.authUser.id,
        action: 'reset_password',
        resource: 'user',
        resourceId: userId,
        details: { targetEmail: targetUser.email },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({ message: "Password reset successfully", temporaryPassword });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Get invitation by token (public endpoint for accepting invitations)
  app.get("/api/invitations/token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Check if invitation has expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if invitation was already accepted
      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation has already been processed" });
      }

      res.json(invitation);
    } catch (error) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

  // Accept invitation (authenticated endpoint)
  app.post("/api/invitations/accept/:token", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { token } = req.params;
      const userId = req.authUser.id;
      
      // Get the invitation
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Check if invitation has expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if invitation was already accepted
      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation has already been processed" });
      }

      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user's email matches the invitation email
      if (user.email !== invitation.email) {
        return res.status(403).json({ 
          message: "This invitation is for a different email address. Please log in with the invited email or contact your administrator." 
        });
      }

      // Check if user is already associated with a tenant
      if (user.tenantId && user.tenantId !== invitation.tenantId) {
        return res.status(400).json({ 
          message: "You are already associated with a different organization. Please contact support." 
        });
      }

      // Associate user with tenant if not already associated
      if (!user.tenantId) {
        await storage.upsertUser({
          id: userId,
          tenantId: invitation.tenantId,
          status: 'active',
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          telegram: user.telegram,
        });
      }

      // Add user to specified groups
      const groupIds = Array.isArray(invitation.groupIds) ? invitation.groupIds : [];
      for (const groupId of groupIds) {
        try {
          await storage.addUserToGroup(userId, groupId, invitation.tenantId);
        } catch (error) {
          console.error(`Error adding user to group ${groupId}:`, error);
          // Continue adding to other groups even if one fails
        }
      }

      // Update invitation status
      await storage.updateUserInvitation(invitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
      });

      // Create audit log
      await storage.createAuditLog({
        tenantId: invitation.tenantId,
        userId,
        action: 'user.invitation.accepted',
        resource: 'user_invitation',
        resourceId: invitation.id,
        details: {
          email: invitation.email,
          groups: groupIds,
        },
      });

      res.json({ 
        message: "Invitation accepted successfully",
        tenantId: invitation.tenantId,
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Delete/Cancel an invitation
  app.delete("/api/invitations/:id", isAuthenticated, requirePermission(PERMISSIONS.USERS_INVITE), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const success = await storage.deleteUserInvitation(id);
      if (!success) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error("Error deleting invitation:", error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  // ==========================================================================
  // RBAC Routes - Audit Logs
  // ==========================================================================

  // Get audit logs with filtering and pagination
  app.get("/api/audit-logs", isAuthenticated, requirePermission(PERMISSIONS.AUDIT_LOGS_READ), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { 
        limit = '50', 
        userId: filterUserId,
        action: filterAction,
        resource: filterResource,
      } = req.query;

      const limitNum = parseInt(limit as string, 10);

      // Use storage methods based on filters
      let logs;
      if (filterUserId) {
        logs = await storage.getAuditLogsByUser(req.authUser.tenantId, filterUserId as string);
      } else if (filterAction) {
        logs = await storage.getAuditLogsByAction(req.authUser.tenantId, filterAction as string);
      } else if (filterResource) {
        logs = await storage.getAuditLogsByResource(req.authUser.tenantId, filterResource as string);
      } else {
        logs = await storage.getAuditLogs(req.authUser.tenantId, limitNum);
      }

      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ==========================================================================
  // RBAC Routes - User Management
  // ==========================================================================

  // Note: GET /api/users already exists earlier in this file at line ~195

  // Update user status (activate/suspend)
  app.patch("/api/users/:userId/status", isAuthenticated, requirePermission(PERMISSIONS.USERS_UPDATE), async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId: targetUserId } = req.params;
      const { status } = req.body;

      if (!status || !['active', 'suspended'].includes(status)) {
        return res.status(400).json({ message: "Valid status (active/suspended) is required" });
      }

      // Verify target user belongs to same tenant
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.tenantId !== req.authUser.tenantId) {
        return res.status(403).json({ message: "Unauthorized to modify this user" });
      }

      // Prevent users from suspending themselves
      if (targetUserId === req.authUser.id) {
        return res.status(400).json({ message: "Cannot change your own status" });
      }

      const updatedUser = await storage.upsertUser({
        id: targetUserId,
        tenantId: targetUser.tenantId,
        status,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // ========================================================================
  // Invoice routes
  // ========================================================================

  // Create invoice
  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const invoiceData = req.body;
      
      // Validate required fields
      if (!invoiceData.ticketId || !invoiceData.type) {
        return res.status(400).json({ message: "Ticket ID and invoice type are required" });
      }

      // Validate invoice type
      if (!['drop_off', 'final'].includes(invoiceData.type)) {
        return res.status(400).json({ message: "Invalid invoice type. Must be 'drop_off' or 'final'" });
      }

      // Verify ticket exists and belongs to this tenant
      const ticket = await storage.getTicket(invoiceData.ticketId, req.authUser.tenantId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Get the next invoice number
      const invoiceNumber = await storage.getNextInvoiceNumber(req.authUser.tenantId);

      const invoice = await storage.createInvoice({
        ...invoiceData,
        tenantId: req.authUser.tenantId,
        invoiceNumber,
        issuedBy: req.authUser.id,
      });

      res.json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Get invoice by ID
  app.get("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const invoice = await storage.getInvoice(req.params.id, req.authUser.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Get invoices by ticket
  app.get("/api/tickets/:ticketId/invoices", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const invoices = await storage.getInvoicesByTicket(req.params.ticketId, req.authUser.tenantId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // ========================================================================
  // Signature Request Routes (SMS-based client signatures)
  // ========================================================================

  // Check if Twilio is configured
  app.get("/api/signature-requests/config", isAuthenticated, async (req: any, res) => {
    try {
      const configured = await isTwilioConfigured();
      res.json({ configured });
    } catch (error) {
      console.error("Error checking Twilio config:", error);
      res.json({ configured: false });
    }
  });

  // Create signature request and send SMS (rate limited)
  app.post("/api/signature-requests", isAuthenticated, signatureSmsRateLimiter, signatureSmsPerPhoneRateLimiter, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { clientId, ticketId, type, language = 'en' } = req.body;

      // Validate required fields
      if (!clientId || !type) {
        return res.status(400).json({ message: "Client ID and signature type are required" });
      }

      // Validate type
      if (!['dropoff', 'pickup'].includes(type)) {
        return res.status(400).json({ message: "Invalid signature type. Must be 'dropoff' or 'pickup'" });
      }

      // Get client to verify they exist and get phone number
      const client = await storage.getClient(clientId, req.authUser.tenantId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (!client.phone) {
        return res.status(400).json({ message: "Client has no phone number configured" });
      }

      // Get store settings for shop name and default country code
      const storeSettings = await storage.getStoreSettings(req.authUser.tenantId);
      const storeName = storeSettings?.shopName || 'Repair Beam';
      const defaultCountryCode = storeSettings?.defaultCountryCode || '+55';

      // Format phone number with country code
      const { formatPhoneWithCountryCode } = await import('./utils/phone.js');
      const clientPhone = formatPhoneWithCountryCode(client.phone, defaultCountryCode);

      // Generate unique token for signing URL
      const token = nanoid(32);
      
      // Token expires in 60 minutes
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Create signature request in database
      const signatureRequest = await storage.createSignatureRequest({
        tenantId: req.authUser.tenantId,
        clientId,
        ticketId: ticketId || null,
        type,
        token,
        clientPhone,
        expiresAt,
      });

      // Build signature URL with language parameter
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAIN 
          ? `https://${process.env.REPLIT_DOMAIN}`
          : 'http://localhost:5000';
      const signatureUrl = `${baseUrl}/sign/${token}?lang=${language}`;

      // Send SMS
      const clientName = `${client.firstName} ${client.lastName || ''}`.trim();
      const smsResult = await sendSignatureSMS(
        clientPhone,
        signatureUrl,
        clientName,
        storeName,
        type,
        language as 'en' | 'pt-BR'
      );

      if (smsResult.success) {
        // Mark as sent with the message SID
        await storage.markSignatureRequestSent(signatureRequest.id, smsResult.messageSid!);
        
        // Log audit event: SMS sent successfully
        await storage.createSignatureAuditEvent({
          signatureRequestId: signatureRequest.id,
          tenantId: req.authUser.tenantId,
          eventType: 'sms_sent',
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { messageSid: smsResult.messageSid, clientPhone }
        });
        
        res.json({
          id: signatureRequest.id,
          status: 'sent',
          token,
          expiresAt,
          message: 'SMS sent successfully'
        });
      } else {
        // Mark as failed
        await storage.updateSignatureRequestStatus(signatureRequest.id, 'failed', {
          failureReason: smsResult.error
        });
        
        // Log audit event: SMS failed
        await storage.createSignatureAuditEvent({
          signatureRequestId: signatureRequest.id,
          tenantId: req.authUser.tenantId,
          eventType: 'sms_failed',
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { error: smsResult.error, clientPhone }
        });
        
        res.status(500).json({
          id: signatureRequest.id,
          status: 'failed',
          error: smsResult.error || 'Failed to send SMS'
        });
      }
    } catch (error) {
      console.error("Error creating signature request:", error);
      res.status(500).json({ message: "Failed to create signature request" });
    }
  });

  // Get signature request status (for polling)
  app.get("/api/signature-requests/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const signatureRequest = await storage.getSignatureRequest(req.params.id, req.authUser.tenantId);
      if (!signatureRequest) {
        return res.status(404).json({ message: "Signature request not found" });
      }

      // Check if expired
      if (signatureRequest.status === 'sent' && new Date() > signatureRequest.expiresAt) {
        await storage.updateSignatureRequestStatus(signatureRequest.id, 'expired');
        
        // Log audit event: signature expired
        await storage.createSignatureAuditEvent({
          signatureRequestId: signatureRequest.id,
          tenantId: req.authUser.tenantId,
          eventType: 'signature_expired',
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { expiresAt: signatureRequest.expiresAt.toISOString(), detectedVia: 'status_check' }
        });
        
        return res.json({
          id: signatureRequest.id,
          status: 'expired',
          type: signatureRequest.type,
          expiresAt: signatureRequest.expiresAt
        });
      }

      res.json({
        id: signatureRequest.id,
        status: signatureRequest.status,
        type: signatureRequest.type,
        expiresAt: signatureRequest.expiresAt,
        signedAt: signatureRequest.signedAt,
        hasSignature: !!signatureRequest.signaturePng
      });
    } catch (error) {
      console.error("Error fetching signature request status:", error);
      res.status(500).json({ message: "Failed to fetch signature request status" });
    }
  });

  // Get signature requests for a ticket
  app.get("/api/tickets/:ticketId/signatures", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const signatures = await storage.getSignatureRequestsByTicket(req.params.ticketId, req.authUser.tenantId);
      res.json(signatures);
    } catch (error) {
      console.error("Error fetching ticket signatures:", error);
      res.status(500).json({ message: "Failed to fetch ticket signatures" });
    }
  });

  // Get audit trail for a signature request
  app.get("/api/signature-requests/:id/audit", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Verify the signature request exists and belongs to this tenant
      const signatureRequest = await storage.getSignatureRequest(req.params.id, req.authUser.tenantId);
      if (!signatureRequest) {
        return res.status(404).json({ message: "Signature request not found" });
      }

      // Get audit events for this signature request
      const auditEvents = await storage.getSignatureAuditEvents(req.params.id, req.authUser.tenantId);
      res.json(auditEvents);
    } catch (error) {
      console.error("Error fetching signature audit events:", error);
      res.status(500).json({ message: "Failed to fetch signature audit events" });
    }
  });

  // Resend signature request SMS (rate limited)
  app.post("/api/signature-requests/:id/resend", isAuthenticated, signatureSmsRateLimiter, async (req: any, res) => {
    try {
      if (!req.authUser || !req.authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { language = 'en' } = req.body;

      const signatureRequest = await storage.getSignatureRequest(req.params.id, req.authUser.tenantId);
      if (!signatureRequest) {
        return res.status(404).json({ message: "Signature request not found" });
      }

      // Only allow resend for pending, sent, or failed statuses
      if (!['pending', 'sent', 'failed'].includes(signatureRequest.status)) {
        return res.status(400).json({ message: `Cannot resend signature request with status: ${signatureRequest.status}` });
      }

      // Get client details
      const client = await storage.getClient(signatureRequest.clientId, req.authUser.tenantId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get store settings for shop name and default country code
      const storeSettings = await storage.getStoreSettings(req.authUser.tenantId);
      const storeName = storeSettings?.shopName || 'Repair Beam';
      const defaultCountryCode = storeSettings?.defaultCountryCode || '+55';

      // Format phone number with country code
      const { formatPhoneWithCountryCode } = await import('./utils/phone.js');
      const formattedPhone = formatPhoneWithCountryCode(signatureRequest.clientPhone, defaultCountryCode);

      // Generate new token and extend expiry
      const newToken = nanoid(32);
      const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Update the signature request with new token
      await storage.updateSignatureRequestStatus(signatureRequest.id, 'pending', {
        token: newToken,
        expiresAt: newExpiresAt,
        failureReason: null
      });

      // Build signature URL with language parameter
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAIN 
          ? `https://${process.env.REPLIT_DOMAIN}`
          : 'http://localhost:5000';
      const signatureUrl = `${baseUrl}/sign/${newToken}?lang=${language}`;

      // Send SMS
      const clientName = `${client.firstName} ${client.lastName || ''}`.trim();
      const smsResult = await sendSignatureSMS(
        formattedPhone,
        signatureUrl,
        clientName,
        storeName,
        signatureRequest.type as 'dropoff' | 'pickup',
        language as 'en' | 'pt-BR'
      );

      if (smsResult.success) {
        await storage.markSignatureRequestSent(signatureRequest.id, smsResult.messageSid!);
        
        // Log audit event: SMS resent successfully
        await storage.createSignatureAuditEvent({
          signatureRequestId: signatureRequest.id,
          tenantId: req.authUser.tenantId,
          eventType: 'sms_resent',
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { messageSid: smsResult.messageSid, clientPhone: signatureRequest.clientPhone, newToken }
        });
        
        res.json({
          id: signatureRequest.id,
          status: 'sent',
          token: newToken,
          expiresAt: newExpiresAt,
          message: 'SMS resent successfully'
        });
      } else {
        await storage.updateSignatureRequestStatus(signatureRequest.id, 'failed', {
          failureReason: smsResult.error
        });
        
        // Log audit event: SMS resend failed
        await storage.createSignatureAuditEvent({
          signatureRequestId: signatureRequest.id,
          tenantId: req.authUser.tenantId,
          eventType: 'sms_failed',
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { error: smsResult.error, clientPhone: signatureRequest.clientPhone, wasResend: true }
        });
        
        res.status(500).json({
          id: signatureRequest.id,
          status: 'failed',
          error: smsResult.error || 'Failed to resend SMS'
        });
      }
    } catch (error) {
      console.error("Error resending signature request:", error);
      res.status(500).json({ message: "Failed to resend signature request" });
    }
  });

  // ========================================================================
  // Public Signature Routes (No authentication required)
  // ========================================================================

  // Get signature request details for signing page (public, rate limited)
  app.get("/api/public/signature/:token", publicSignatureRateLimiter, async (req, res) => {
    try {
      const signatureRequest = await storage.getSignatureRequestByToken(req.params.token);
      
      if (!signatureRequest) {
        return res.status(404).json({ message: "Signature request not found" });
      }

      // Check if expired
      if (new Date() > signatureRequest.expiresAt) {
        if (signatureRequest.status === 'sent') {
          await storage.updateSignatureRequestStatus(signatureRequest.id, 'expired');
          
          // Log audit event: expired when link opened
          await storage.createSignatureAuditEvent({
            signatureRequestId: signatureRequest.id,
            tenantId: signatureRequest.tenantId,
            eventType: 'signature_expired',
            ipAddress: req.ip || req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: { expiresAt: signatureRequest.expiresAt.toISOString(), detectedVia: 'link_opened' }
          });
        }
        return res.status(410).json({ message: "This signature link has expired" });
      }

      // Check if already signed
      if (signatureRequest.status === 'signed') {
        return res.status(409).json({ message: "This document has already been signed" });
      }

      // Log audit event: link opened
      await storage.createSignatureAuditEvent({
        signatureRequestId: signatureRequest.id,
        tenantId: signatureRequest.tenantId,
        eventType: 'link_opened',
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { token: req.params.token }
      });

      // Get client info
      const client = await storage.getClient(signatureRequest.clientId, signatureRequest.tenantId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get store settings
      const storeSettings = await storage.getStoreSettings(signatureRequest.tenantId);

      // Get ticket info if available
      let ticketInfo = null;
      if (signatureRequest.ticketId) {
        const ticket = await storage.getTicket(signatureRequest.ticketId, signatureRequest.tenantId);
        if (ticket) {
          ticketInfo = {
            id: ticket.id,
            title: ticket.title,
            deviceType: ticket.deviceType,
            deviceBrand: ticket.deviceBrand,
            deviceModel: ticket.deviceModel,
            estimatedCost: ticket.estimatedCost,
            status: ticket.status
          };
        }
      }

      res.json({
        id: signatureRequest.id,
        type: signatureRequest.type,
        status: signatureRequest.status,
        expiresAt: signatureRequest.expiresAt,
        client: {
          firstName: client.firstName,
          lastName: client.lastName
        },
        store: {
          name: storeSettings?.shopName || 'Repair Beam',
          logo: storeSettings?.shopLogoUrl
        },
        ticket: ticketInfo
      });
    } catch (error) {
      console.error("Error fetching signature request details:", error);
      res.status(500).json({ message: "Failed to fetch signature request details" });
    }
  });

  // Submit signature (public, rate limited)
  app.post("/api/public/signature/:token/submit", signatureSubmitRateLimiter, signatureSubmitPerTokenRateLimiter, async (req, res) => {
    try {
      const { signaturePng, agreedToTerms, deviceMeta } = req.body;

      if (!signaturePng) {
        return res.status(400).json({ message: "Signature is required" });
      }

      if (!agreedToTerms) {
        return res.status(400).json({ message: "You must agree to the terms" });
      }

      // Validate signature is base64 PNG
      if (!signaturePng.startsWith('data:image/png;base64,')) {
        return res.status(400).json({ message: "Invalid signature format" });
      }

      // Validate signature size (max 500KB base64 = ~375KB actual image)
      const MAX_SIGNATURE_SIZE = 500 * 1024;
      if (signaturePng.length > MAX_SIGNATURE_SIZE) {
        return res.status(400).json({ message: "Signature image is too large" });
      }

      const signatureRequest = await storage.getSignatureRequestByToken(req.params.token);
      
      if (!signatureRequest) {
        return res.status(404).json({ message: "Signature request not found" });
      }

      // Check if expired
      if (new Date() > signatureRequest.expiresAt) {
        if (signatureRequest.status === 'sent') {
          await storage.updateSignatureRequestStatus(signatureRequest.id, 'expired');
        }
        return res.status(410).json({ message: "This signature link has expired" });
      }

      // Check if already signed
      if (signatureRequest.status === 'signed') {
        return res.status(409).json({ message: "This document has already been signed" });
      }

      // Capture comprehensive device metadata for audit trail
      const signerDeviceMeta = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.socket?.remoteAddress,
        timestamp: new Date().toISOString(),
        ...(deviceMeta || {}),
      };

      // Mark as signed
      const updated = await storage.markSignatureRequestSigned(
        signatureRequest.id,
        signaturePng,
        signerDeviceMeta
      );

      // Log audit event: signature completed
      await storage.createSignatureAuditEvent({
        signatureRequestId: signatureRequest.id,
        tenantId: signatureRequest.tenantId,
        eventType: 'signature_completed',
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        deviceMeta: signerDeviceMeta,
        metadata: { signedAt: updated?.signedAt?.toISOString(), type: signatureRequest.type }
      });

      // If this is linked to a ticket, update the ticket with signature reference
      if (signatureRequest.ticketId) {
        // Update the ticket with the signature ID
        const ticketUpdateData: Record<string, string | null> = {};
        if (signatureRequest.type === 'dropoff') {
          ticketUpdateData.dropoffSignatureId = signatureRequest.id;
        } else {
          ticketUpdateData.pickupSignatureId = signatureRequest.id;
        }
        await storage.updateTicket(signatureRequest.ticketId, signatureRequest.tenantId, ticketUpdateData);
      }

      res.json({
        success: true,
        message: signatureRequest.type === 'dropoff' 
          ? 'Thank you! Your repair has been authorized.' 
          : 'Thank you! Device pickup confirmed.',
        signedAt: updated?.signedAt
      });
    } catch (error) {
      console.error("Error submitting signature:", error);
      res.status(500).json({ message: "Failed to submit signature" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
