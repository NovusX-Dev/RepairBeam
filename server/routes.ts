import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { aiService } from "./aiService";
import { deviceColorService } from "./deviceColorService";
import { normalizeCurrency, toCents, fromCents } from "@shared/money";
import { insertTicketSchema, insertChecklistSchema, isValidStatusTransition, getAllowedNextStatuses, type TicketStatus } from "@shared/schema";
import { z } from "zod";

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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tenantId = user.tenantId;
      
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

      // Calculate completion analytics metrics
      const completionRate = totalTickets > 0 ? ((completedTickets / totalTickets) * 100).toFixed(1) : '0.0';
      
      // Calculate average accuracy score from recent completions
      const avgAccuracyScore = completionAnalytics.length > 0 
        ? (completionAnalytics.reduce((sum, a) => sum + parseFloat(a.accuracyScore || '0'), 0) / completionAnalytics.length).toFixed(1)
        : '0.0';
      
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
        ? (completionAnalytics.reduce((sum, a) => sum + parseFloat(a.hoursVariancePercentage || '0'), 0) / completionAnalytics.length).toFixed(1)
        : '0.0';
      
      // Calculate cost variance trend
      const avgCostVariance = completionAnalytics.length > 0
        ? (completionAnalytics.reduce((sum, a) => sum + parseFloat(a.costVariancePercentage || '0'), 0) / completionAnalytics.length).toFixed(1)
        : '0.0';

      res.json({
        openTickets,
        monthlyRevenue: formattedMonthlyRevenue,
        lowStockItems,
        activeClients: clients.length,
        // Completion Analytics Metrics
        completionRate: parseFloat(completionRate),
        completedTickets,
        totalTickets,
        avgAccuracyScore: parseFloat(avgAccuracyScore),
        completionRevenue: formattedCompletionRevenue,
        avgTimeVariance: parseFloat(avgTimeVariance),
        avgCostVariance: parseFloat(avgCostVariance),
        recentCompletions: completionAnalytics.length
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // User routes
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const users = await storage.getUsersByTenant(user.tenantId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Client routes
  app.get("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const clients = await storage.getClients(user.tenantId);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // Ticket routes
  app.get("/api/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let tickets = await storage.getTicketsWithClients(user.tenantId);

      // Apply filters if provided in query params
      const { search, status, priority, assignedTo, deviceType, dateFrom, dateTo } = req.query;

      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        tickets = tickets.filter(ticket => 
          ticket.title?.toLowerCase().includes(searchLower) ||
          ticket.client?.name?.toLowerCase().includes(searchLower) ||
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
  app.get("/api/tickets/client/:clientId", isAuthenticated, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tickets = await storage.getTicketsByClientId(clientId, user.tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets by client:", error);
      res.status(500).json({ message: "Failed to fetch tickets by client" });
    }
  });

  // Check if ticket ID exists (for unique ID generation)
  app.get("/api/tickets/check-id/:ticketId", isAuthenticated, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const exists = await storage.checkTicketIdExists(ticketId, user.tenantId);
      res.json({ exists });
    } catch (error) {
      console.error("Error checking ticket ID:", error);
      res.status(500).json({ message: "Failed to check ticket ID" });
    }
  });

  // Get single ticket by ID with client details (must be after specific routes)
  app.get("/api/tickets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tickets = await storage.getTicketsWithClients(user.tenantId);
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
  app.post("/api/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { issueResponses, ...ticketBody } = req.body;
      
      // Validate and normalize currency fields before creating ticket
      const validationResult = validatedTicketSchema.safeParse({
        ...ticketBody,
        tenantId: user.tenantId,
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
      const { ticketId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const notes = await storage.getTicketNotes(ticketId, user.tenantId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching ticket notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  // Add ticket note
  app.post("/api/tickets/:ticketId/notes", isAuthenticated, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const { content } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const note = await storage.createTicketNote({
        ticketId,
        userId,
        content,
        tenantId: user.tenantId
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
      const { ticketId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const responses = await storage.getIssueResponses(ticketId);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching issue responses:", error);
      res.status(500).json({ message: "Failed to fetch issue responses" });
    }
  });

  app.put("/api/tickets/:ticketId/status", isAuthenticated, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      // Get current ticket to validate status transition
      const currentTicket = await storage.getTicket(ticketId, user.tenantId);
      
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

      const updatedTicket = await storage.updateTicketStatus(ticketId, status, user.tenantId);
      
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
  app.put("/api/tickets/:ticketId/finalize", isAuthenticated, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const { completionNotes, actualHours, finalActualCost, confirmedItemIds = [] } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (actualHours === undefined || finalActualCost === undefined) {
        return res.status(400).json({ message: "Actual hours and final cost are required" });
      }

      // Get all ticket items
      const ticketItems = await storage.getTicketItems(ticketId, user.tenantId);
      
      // Process each ticket item based on confirmation
      for (const ticketItem of ticketItems) {
        if (confirmedItemIds.includes(ticketItem.id)) {
          // Item was used - mark as confirmed
          await storage.updateTicketItem(ticketItem.id, user.tenantId, {
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
          const inventoryItem = await storage.getInventoryItem(ticketItem.inventoryItemId, user.tenantId);
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
            await storage.updateInventoryItem(inventoryItem.id, user.tenantId, {
              quantity: inventoryItem.quantity + ticketItem.quantity,
            });
          }

          // Delete the unconfirmed ticket item
          await storage.deleteTicketItem(ticketItem.id, user.tenantId);
        }
      }

      const finalizedTicket = await storage.finalizeTicket(
        ticketId, 
        user.tenantId,
        userId,
        completionNotes || '', // Allow empty completion notes
        parseInt(actualHours),
        parseFloat(finalActualCost)
      );
      
      if (!finalizedTicket) {
        return res.status(404).json({ message: "Ticket not found" });
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

  // Update ticket priority
  app.put("/api/tickets/:ticketId/priority", isAuthenticated, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const { priority } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!priority) {
        return res.status(400).json({ message: "Priority is required" });
      }

      const updatedTicket = await storage.updateTicketPriority(ticketId, priority, user.tenantId);
      
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
  app.delete("/api/tickets/:ticketId", isAuthenticated, async (req: any, res) => {
    try {
      const { ticketId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return ticket items to inventory before deleting
      const ticketItems = await storage.getTicketItems(ticketId, user.tenantId);
      for (const ticketItem of ticketItems) {
        const inventoryItem = await storage.getInventoryItem(ticketItem.inventoryItemId, user.tenantId);
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
          await storage.updateInventoryItem(inventoryItem.id, user.tenantId, {
            quantity: inventoryItem.quantity + ticketItem.quantity,
          });
        }
      }

      // Delete all ticket items
      await storage.deleteTicketItemsByTicketId(ticketId, user.tenantId);

      // Delete the ticket
      const deleted = await storage.deleteTicket(ticketId, user.tenantId);
      
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get or create a client first
      let clients = await storage.getClients(user.tenantId);
      let clientId;
      
      if (clients.length === 0) {
        // Create a sample client
        const sampleClient = await storage.createClient({
          tenantId: user.tenantId,
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
          tenantId: user.tenantId,
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
          tenantId: user.tenantId,
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
          tenantId: user.tenantId,
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
          tenantId: user.tenantId,
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
          tenantId: user.tenantId,
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
  app.get("/api/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const searchQuery = req.query.search as string | undefined;
      
      let items;
      if (searchQuery && searchQuery.trim()) {
        items = await storage.searchInventoryItems(user.tenantId, searchQuery.trim());
      } else {
        items = await storage.getInventoryItems(user.tenantId);
      }
      
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  app.post("/api/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const itemData = { ...req.body, tenantId: user.tenantId };
      const newItem = await storage.createInventoryItem(itemData);
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const updatedItem = await storage.updateInventoryItem(id, user.tenantId, req.body);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ message: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteInventoryItem(id, user.tenantId);
      
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { ticketId } = req.params;
      const items = await storage.getTicketItems(ticketId, user.tenantId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching ticket items:", error);
      res.status(500).json({ message: "Failed to fetch ticket items" });
    }
  });

  // Get available service items for ticket (filtered by device type)
  app.get("/api/inventory/available-for-ticket/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { deviceType } = req.params;
      
      // Get all inventory items with supplier info for the tenant
      const allItemsWithSuppliers = await storage.getInventoryItemsWithSuppliers(user.tenantId);
      
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { ticketId } = req.params;
      const { inventoryItemId, quantity, unitPrice } = req.body;

      // Use atomic transaction to add ticket item and deduct inventory
      const ticketItem = await storage.addTicketItemWithInventoryDeduction({
        tenantId: user.tenantId,
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

  app.delete("/api/tickets/:ticketId/items/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { itemId } = req.params;

      // Use atomic transaction to remove ticket item and restore inventory
      await storage.removeTicketItemWithInventoryRestore({
        ticketItemId: itemId,
        tenantId: user.tenantId,
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
  app.get("/api/inventory-units/verify/:uniqueTag", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { uniqueTag } = req.params;
      
      // Sanitize input
      if (!uniqueTag || uniqueTag.trim().length === 0) {
        return res.status(400).json({ message: "Invalid unit tag" });
      }
      
      // Get inventory unit by unique tag (with tenant isolation)
      const unit = await storage.getInventoryUnitByTag(uniqueTag, user.tenantId);
      
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }

      // Get the inventory item to get details
      const inventoryItem = await storage.getInventoryItem(unit.inventoryItemId, user.tenantId);
      
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

  app.get("/api/inventory-units/:unitId/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { unitId } = req.params;
      const history = await storage.getInventoryUnitHistory(unitId, user.tenantId);
      
      if (!history) {
        return res.status(404).json({ message: "Inventory unit not found" });
      }

      res.json(history);
    } catch (error) {
      console.error("Error fetching inventory unit history:", error);
      res.status(500).json({ message: "Failed to fetch inventory unit history" });
    }
  });

  app.get("/api/inventory/:itemId/usage-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { itemId } = req.params;
      const stats = await storage.getInventoryItemUsageStats(itemId, user.tenantId);
      
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { itemId } = req.params;
      
      // Verify the item belongs to this tenant
      const item = await storage.getInventoryItem(itemId, user.tenantId);
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      // Get all units for this item
      const units = await storage.getInventoryUnitsByItem(itemId, user.tenantId);
      res.json(units);
    } catch (error) {
      console.error("Error fetching inventory units:", error);
      res.status(500).json({ message: "Failed to fetch inventory units" });
    }
  });

  // Supplier routes
  app.get("/api/suppliers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const suppliers = await storage.getSuppliers(user.tenantId);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const supplierData = { ...req.body, tenantId: user.tenantId };
      const newSupplier = await storage.createSupplier(supplierData);
      res.status(201).json(newSupplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const updatedSupplier = await storage.updateSupplier(id, user.tenantId, req.body);
      
      if (!updatedSupplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      res.json(updatedSupplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ message: "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteSupplier(id, user.tenantId);
      
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const categories = await storage.getInventoryCategories(user.tenantId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching inventory categories:", error);
      res.status(500).json({ message: "Failed to fetch inventory categories" });
    }
  });

  app.post("/api/inventory-categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const categoryData = { ...req.body, tenantId: user.tenantId };
      const newCategory = await storage.createInventoryCategory(categoryData);
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating inventory category:", error);
      res.status(500).json({ message: "Failed to create inventory category" });
    }
  });

  app.put("/api/inventory-categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const updatedCategory = await storage.updateInventoryCategory(id, user.tenantId, req.body);
      
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteInventoryCategory(id, user.tenantId);
      
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
  app.get("/api/purchase-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const purchaseOrders = await storage.getPurchaseOrders(user.tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.post("/api/purchase-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { supplierId, items, expectedDate, notes } = req.body;

      // Create the purchase order
      const poData = {
        tenantId: user.tenantId,
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

  app.get("/api/purchase-orders/:id/items", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;

      // Verify PO belongs to tenant
      const po = await storage.getPurchaseOrder(id, user.tenantId);
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

  app.post("/api/purchase-orders/:id/finalize", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;
      const { items } = req.body;

      // Get the PO
      const po = await storage.getPurchaseOrder(id, user.tenantId);
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
          const allInventoryItems = await storage.getInventoryItems(user.tenantId);
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
              await storage.updateInventoryItem(inventoryItemId, user.tenantId, {
                supplierId: po.supplierId,
              });
            }
          } else {
            // Create new inventory item (new item or same item from different supplier)
            const newInventoryItem = await storage.createInventoryItem({
              tenantId: user.tenantId,
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
            tenantId: user.tenantId,
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
        const inventoryItem = await storage.getInventoryItem(inventoryItemId, user.tenantId);
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
          
          await storage.updateInventoryItem(inventoryItemId, user.tenantId, {
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
      await storage.updatePurchaseOrder(id, user.tenantId, {
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
  app.patch("/api/purchase-orders/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { id } = req.params;

      // Get the PO to verify it's in pending status
      const po = await storage.getPurchaseOrder(id, user.tenantId);
      if (!po) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      if (po.status !== 'pending') {
        return res.status(400).json({ message: "Only pending purchase orders can be cancelled" });
      }

      // Update PO status to cancelled
      await storage.updatePurchaseOrder(id, user.tenantId, {
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const transactions = await storage.getTransactions(user.tenantId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Support ticket routes
  app.get("/api/support-tickets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const supportTickets = await storage.getSupportTickets(user.tenantId);
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        await storage.upsertUser({
          ...user,
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const tenant = await storage.getTenant(user.tenantId);
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
        profileImageUrl: user.tenant?.shopImageUrl, // Use shop image instead of user profile image
        tenantAlias: user.tenant?.alias || user.tenant?.name || 'Shop',
        tenantName: user.tenant?.name || 'Shop'
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { pageType } = req.query;
      const presets = await storage.getFilterPresets(user.tenantId, userId, pageType as string);
      res.json(presets);
    } catch (error) {
      console.error("Error fetching filter presets:", error);
      res.status(500).json({ message: "Failed to fetch filter presets" });
    }
  });

  app.post("/api/filter-presets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const presetData = {
        ...req.body,
        tenantId: user.tenantId,
        userId: userId
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const preset = await storage.updateFilterPreset(req.params.id, user.tenantId, userId, req.body);
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.deleteFilterPreset(req.params.id, user.tenantId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting filter preset:", error);
      res.status(500).json({ message: "Failed to delete filter preset" });
    }
  });

  // Client search endpoint
  app.get("/api/clients/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const clients = await storage.searchClients(user.tenantId, query.trim());
      res.json(clients);
    } catch (error) {
      console.error("Error searching clients:", error);
      res.status(500).json({ message: "Failed to search clients" });
    }
  });

  // Get client by CPF endpoint
  app.get("/api/clients/cpf/:cpf", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { cpf } = req.params;
      const client = await storage.getClientByCPF(user.tenantId, cpf);
      
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
  app.post("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const clientData = { ...req.body, tenantId: user.tenantId };
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Update client endpoint
  app.put("/api/clients/:clientId", isAuthenticated, async (req: any, res) => {
    try {
      const { clientId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const client = await storage.updateClient(clientId, req.body, user.tenantId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
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
      // Check if user has admin privileges (you can add this check later)
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
      const { category } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

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
      const { category } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

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
      const { category, brand } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

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
      const { category } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

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
      const { category } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
      const { category } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`⚠️  COST WARNING: User ${userId} is retrying failed brands for ${category}`);
      
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
      const { ticketId, responses } = req.body;
      
      if (!ticketId || !responses || !Array.isArray(responses)) {
        return res.status(400).json({ message: "ticketId and responses array are required" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify ticket belongs to user's tenant
      const ticket = await storage.getTicket(ticketId, user.tenantId);
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
      const { ticketId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify ticket belongs to user's tenant
      const ticket = await storage.getTicket(ticketId, user.tenantId);
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
  app.get("/api/store-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const settings = await storage.getStoreSettings(user.tenantId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching store settings:", error);
      res.status(500).json({ message: "Failed to fetch store settings" });
    }
  });

  app.post("/api/store-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const settings = await storage.createStoreSettings({
        tenantId: user.tenantId,
        ...req.body
      });
      res.json(settings);
    } catch (error) {
      console.error("Error creating store settings:", error);
      res.status(500).json({ message: "Failed to create store settings" });
    }
  });

  app.put("/api/store-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const settings = await storage.updateStoreSettings(user.tenantId, req.body);
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tiers = await storage.getWarrantyTiers(user.tenantId);
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching warranty tiers:", error);
      res.status(500).json({ message: "Failed to fetch warranty tiers" });
    }
  });

  app.get("/api/warranty-tiers/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      const { deviceType } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tiers = await storage.getWarrantyTiersByDeviceType(user.tenantId, deviceType);
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching warranty tiers for device type:", error);
      res.status(500).json({ message: "Failed to fetch warranty tiers for device type" });
    }
  });

  app.post("/api/warranty-tiers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tier = await storage.createWarrantyTier({
        tenantId: user.tenantId,
        ...req.body
      });
      res.json(tier);
    } catch (error) {
      console.error("Error creating warranty tier:", error);
      res.status(500).json({ message: "Failed to create warranty tier" });
    }
  });

  app.put("/api/warranty-tiers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tier = await storage.updateWarrantyTier(id, user.tenantId, req.body);
      if (!tier) {
        return res.status(404).json({ message: "Warranty tier not found" });
      }
      res.json(tier);
    } catch (error) {
      console.error("Error updating warranty tier:", error);
      res.status(500).json({ message: "Failed to update warranty tier" });
    }
  });

  app.delete("/api/warranty-tiers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const success = await storage.deleteWarrantyTier(id, user.tenantId);
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const services = await storage.getRepairServices(user.tenantId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching repair services:", error);
      res.status(500).json({ message: "Failed to fetch repair services" });
    }
  });

  app.get("/api/repair-services/device/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      const { deviceType } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const services = await storage.getRepairServicesByDeviceType(user.tenantId, deviceType);
      res.json(services);
    } catch (error) {
      console.error("Error fetching repair services by device type:", error);
      res.status(500).json({ message: "Failed to fetch repair services" });
    }
  });

  app.post("/api/repair-services", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const service = await storage.createRepairService({
        tenantId: user.tenantId,
        ...req.body
      });
      res.json(service);
    } catch (error) {
      console.error("Error creating repair service:", error);
      res.status(500).json({ message: "Failed to create repair service" });
    }
  });

  app.put("/api/repair-services/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const service = await storage.updateRepairService(id, user.tenantId, req.body);
      if (!service) {
        return res.status(404).json({ message: "Repair service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating repair service:", error);
      res.status(500).json({ message: "Failed to update repair service" });
    }
  });

  app.delete("/api/repair-services/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const success = await storage.deleteRepairService(id, user.tenantId);
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const defects = await storage.getPossibleDefects(user.tenantId);
      res.json(defects);
    } catch (error) {
      console.error("Error fetching possible defects:", error);
      res.status(500).json({ message: "Failed to fetch possible defects" });
    }
  });

  app.get("/api/possible-defects/device/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      const { deviceType } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!deviceType || deviceType.trim() === '') {
        return res.status(400).json({ message: "Device type is required" });
      }

      // Get tenant-specific defects for this device type
      const defects = await storage.getPossibleDefectsByDeviceType(user.tenantId, deviceType);
      
      // Sort alphabetically to ensure consistent ordering
      const sortedDefects = defects.sort((a, b) => a.name.localeCompare(b.name));
      
      res.json(sortedDefects);
    } catch (error) {
      console.error("Error fetching possible defects by device type:", error);
      res.status(500).json({ message: "Failed to fetch possible defects" });
    }
  });

  app.post("/api/possible-defects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const defect = await storage.createPossibleDefect({
        tenantId: user.tenantId,
        ...req.body
      });
      res.json(defect);
    } catch (error) {
      console.error("Error creating possible defect:", error);
      res.status(500).json({ message: "Failed to create possible defect" });
    }
  });

  app.put("/api/possible-defects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const defect = await storage.updatePossibleDefect(id, user.tenantId, req.body);
      if (!defect) {
        return res.status(404).json({ message: "Possible defect not found" });
      }
      res.json(defect);
    } catch (error) {
      console.error("Error updating possible defect:", error);
      res.status(500).json({ message: "Failed to update possible defect" });
    }
  });

  app.delete("/api/possible-defects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const success = await storage.deletePossibleDefect(id, user.tenantId);
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const checklists = await storage.getChecklists(user.tenantId);
      res.json(checklists);
    } catch (error) {
      console.error("Error fetching checklists:", error);
      res.status(500).json({ message: "Failed to fetch checklists" });
    }
  });

  app.get("/api/checklists/device/:deviceType", isAuthenticated, async (req: any, res) => {
    try {
      const { deviceType } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!deviceType || deviceType.trim() === '') {
        return res.status(400).json({ message: "Device type is required" });
      }

      const checklists = await storage.getChecklistsByDeviceType(user.tenantId, deviceType);
      res.json(checklists);
    } catch (error) {
      console.error("Error fetching checklists by device type:", error);
      res.status(500).json({ message: "Failed to fetch checklists by device type" });
    }
  });

  // Initialize default checklists for current tenant (for existing tenants)
  app.post("/api/checklists/initialize", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`🔧 Initializing default checklists for tenant: ${user.tenantId}`);
      await storage.initializeDefaultChecklists(user.tenantId);
      
      res.json({ message: "Default checklists initialized successfully" });
    } catch (error) {
      console.error("Error initializing default checklists:", error);
      res.status(500).json({ message: "Failed to initialize default checklists" });
    }
  });

  app.post("/api/checklists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
        tenantId: user.tenantId,
        ...checklistData
      });
      res.status(201).json(checklist);
    } catch (error) {
      console.error("Error creating checklist:", error);
      res.status(500).json({ message: "Failed to create checklist" });
    }
  });

  app.put("/api/checklists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate request body using Zod schema (partial for updates)
      const validationResult = insertChecklistSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid checklist data", 
          errors: validationResult.error.errors 
        });
      }

      const checklist = await storage.updateChecklist(id, user.tenantId, validationResult.data);
      if (!checklist) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.json(checklist);
    } catch (error) {
      console.error("Error updating checklist:", error);
      res.status(500).json({ message: "Failed to update checklist" });
    }
  });

  app.delete("/api/checklists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const success = await storage.deleteChecklist(id, user.tenantId);
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
  app.get("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const groups = await storage.getGroups(user.tenantId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Get a specific group
  app.get("/api/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const group = await storage.getGroup(id, user.tenantId);
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
  app.post("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const { name, description, permissions, isDefault } = req.body;
      
      // Validate required fields
      if (!name || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ message: "Name and permissions array are required" });
      }

      const newGroup = await storage.createGroup({
        tenantId: user.tenantId,
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
  app.put("/api/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const { name, description, permissions, isDefault } = req.body;

      const updatedGroup = await storage.updateGroup(id, user.tenantId, {
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
  app.delete("/api/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const success = await storage.deleteGroup(id, user.tenantId);
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
  app.get("/api/users/:userId/groups", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser || !currentUser.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const userGroups = await storage.getUserGroups(targetUserId, currentUser.tenantId);
      res.json(userGroups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ message: "Failed to fetch user groups" });
    }
  });

  // Add user to a group
  app.post("/api/users/:userId/groups", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const { groupId } = req.body;
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser || !currentUser.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }

      const userGroup = await storage.addUserToGroup(targetUserId, groupId, currentUser.tenantId);
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
  app.delete("/api/users/:userId/groups/:groupId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId, groupId } = req.params;
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser || !currentUser.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const success = await storage.removeUserFromGroup(targetUserId, groupId, currentUser.tenantId);
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
  app.get("/api/users/:userId/permissions", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser || !currentUser.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const permissions = await storage.getUserPermissions(targetUserId, currentUser.tenantId);
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
  app.get("/api/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const invitations = await storage.getUserInvitations(user.tenantId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Create a new invitation
  app.post("/api/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const { email, firstName, lastName, phone, telegram, groupIds } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user with this email already exists in tenant
      const existingInvitation = await storage.getUserInvitationByEmail(email, user.tenantId);
      if (existingInvitation) {
        return res.status(400).json({ message: "An invitation for this email already exists" });
      }

      // Generate unique token (simple version - in production use crypto.randomBytes)
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await storage.createUserInvitation({
        tenantId: user.tenantId,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        telegram: telegram || null,
        invitedByUserId: userId,
        groupIds: groupIds || [],
        token,
        expiresAt,
        status: 'pending',
      });

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating invitation:", error);
      if (error instanceof Error && error.message.includes('does not belong to this tenant')) {
        return res.status(403).json({ message: "Unauthorized to create invitation" });
      }
      res.status(500).json({ message: "Failed to create invitation" });
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

  // Delete/Cancel an invitation
  app.delete("/api/invitations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

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
  // RBAC Routes - User Management
  // ==========================================================================

  // Get all users for a tenant
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      const users = await storage.getUsersByTenant(user.tenantId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user status (activate/suspend)
  app.patch("/api/users/:userId/status", isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const { status } = req.body;
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser || !currentUser.tenantId) {
        return res.status(404).json({ message: "User not found or not associated with a tenant" });
      }

      if (!status || !['active', 'suspended'].includes(status)) {
        return res.status(400).json({ message: "Valid status (active/suspended) is required" });
      }

      // Verify target user belongs to same tenant
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.tenantId !== currentUser.tenantId) {
        return res.status(403).json({ message: "Unauthorized to modify this user" });
      }

      // Prevent users from suspending themselves
      if (targetUserId === currentUserId) {
        return res.status(400).json({ message: "Cannot change your own status" });
      }

      const updatedUser = await storage.upsertUser({
        id: targetUserId,
        status,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
