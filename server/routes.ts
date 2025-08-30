import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { aiService } from "./aiService";

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

      const tickets = await storage.getTicketsWithClients(user.tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
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

      const updatedTicket = await storage.updateTicketStatus(ticketId, status, user.tenantId);
      
      if (!updatedTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      res.status(500).json({ message: "Failed to update ticket status" });
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

  app.put("/api/tenants/language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { language } = req.body;
      if (!language || !['en', 'pt-BR'].includes(language)) {
        return res.status(400).json({ error: "Invalid language. Supported: en, pt-BR" });
      }

      const updatedTenant = await storage.updateTenantLanguage(user.tenantId, language);
      if (!updatedTenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      res.json(updatedTenant);
    } catch (error) {
      console.error("Error updating tenant language:", error);
      res.status(500).json({ error: "Failed to update tenant language" });
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

  // Create or update client endpoint
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

  const httpServer = createServer(app);
  return httpServer;
}
