import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const [tickets, clients, inventoryItems, transactions] = await Promise.all([
        storage.getTickets(tenantId),
        storage.getClients(tenantId),
        storage.getInventoryItems(tenantId),
        storage.getTransactions(tenantId)
      ]);

      const openTickets = tickets.filter(t => t.status !== 'completed').length;
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
        .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0);

      res.json({
        openTickets,
        monthlyRevenue: monthlyRevenue.toFixed(2),
        lowStockItems,
        activeClients: clients.length
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
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

      const tickets = await storage.getTickets(user.tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
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

      const items = await storage.getInventoryItems(user.tenantId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
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
        name,
        alias,
        shopImageUrl: normalizedShopImageUrl,
        domain: name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      });

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

  const httpServer = createServer(app);
  return httpServer;
}
