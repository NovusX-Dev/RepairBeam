import {
  users,
  tenants,
  clients,
  tickets,
  suppliers,
  inventoryItems,
  purchaseOrders,
  purchaseOrderItems,
  inventoryUnits,
  inventoryUsage,
  ticketItems,
  transactions,
  supportTickets,
  ticketNotes,
  localizations,
  autoGenLists,
  deviceColors,
  deviceChecklistTemplates,
  userProgress,
  achievements,
  userAchievements,
  userActivities,
  issueQuestions,
  issueResponses,
  storeSettings,
  warrantyTiers,
  repairServices,
  possibleDefects,
  checklists,
  completionAnalytics,
  type User,
  type UpsertUser,
  type Tenant,
  type InsertTenant,
  type Client,
  type InsertClient,
  type Ticket,
  type InsertTicket,
  type Supplier,
  type InsertSupplier,
  type InventoryItem,
  type InsertInventoryItem,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type InventoryUnit,
  type InsertInventoryUnit,
  type InventoryUsage,
  type InsertInventoryUsage,
  type TicketItem,
  type InsertTicketItem,
  type Transaction,
  type InsertTransaction,
  type SupportTicket,
  type InsertSupportTicket,
  type TicketNote,
  type InsertTicketNote,
  type Localization,
  type InsertLocalization,
  type AutoGenList,
  type InsertAutoGenList,
  type DeviceColor,
  type InsertDeviceColor,
  type DeviceChecklistTemplate,
  type InsertDeviceChecklistTemplate,
  type UserProgress,
  type InsertUserProgress,
  type Achievement,
  type InsertAchievement,
  type UserAchievement,
  type InsertUserAchievement,
  type UserActivity,
  type InsertUserActivity,
  type IssueQuestion,
  type InsertIssueQuestion,
  type IssueResponse,
  type InsertIssueResponse,
  type StoreSettings,
  type InsertStoreSettings,
  type WarrantyTier,
  type InsertWarrantyTier,
  type RepairService,
  type InsertRepairService,
  type PossibleDefect,
  type InsertPossibleDefect,
  type Checklist,
  type InsertChecklist,
  type CompletionAnalytics,
  type InsertCompletionAnalytics,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, ilike, sql, asc, inArray } from "drizzle-orm";

// Database retry utility with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Database operation failed after ${retries} retries:`, error);
        throw error;
      }
      
      const backoffDelay = delay * Math.pow(2, i);
      console.warn(`Database operation failed (attempt ${i + 1}/${retries}), retrying in ${backoffDelay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error("Unexpected error in withRetry");
}

export interface IStorage {
  // Health check operations
  healthCheck(): Promise<boolean>;
  
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  
  // Client operations
  getClients(tenantId: string): Promise<Client[]>;
  getClient(id: string, tenantId: string): Promise<Client | undefined>;
  getClientByCPF(tenantId: string, cpf: string): Promise<Client | undefined>;
  searchClients(tenantId: string, query: string): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  
  // Ticket operations
  getTickets(tenantId: string): Promise<Ticket[]>;
  getTicketsWithClients(tenantId: string): Promise<(Ticket & { client?: Client })[]>;
  getTicketsByClientId(clientId: string, tenantId: string): Promise<Ticket[]>;
  getTicket(id: string, tenantId: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicketStatus(ticketId: string, status: string, tenantId: string): Promise<Ticket | undefined>;
  updateTicketPriority(ticketId: string, priority: string, tenantId: string): Promise<Ticket | undefined>;
  checkTicketIdExists(ticketId: string, tenantId: string): Promise<boolean>;
  deleteTicket(ticketId: string, tenantId: string): Promise<boolean>;
  finalizeTicket(ticketId: string, tenantId: string, completedBy: string, completionNotes: string, actualHours: number, finalActualCost: number): Promise<Ticket | undefined>;
  
  // Completion analytics operations
  createCompletionAnalytics(analytics: InsertCompletionAnalytics): Promise<CompletionAnalytics>;
  getCompletionAnalytics(tenantId: string, limit?: number): Promise<CompletionAnalytics[]>;
  getAnalyticsByDateRange(tenantId: string, startDate: Date, endDate: Date): Promise<CompletionAnalytics[]>;
  getAnalyticsByDeviceType(tenantId: string, deviceType: string): Promise<CompletionAnalytics[]>;
  getAnalyticsByTechnician(tenantId: string, completedBy: string): Promise<CompletionAnalytics[]>;
  
  // Supplier operations
  getSuppliers(tenantId: string): Promise<Supplier[]>;
  getSupplier(id: string, tenantId: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, tenantId: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string, tenantId: string): Promise<boolean>;
  
  // Inventory operations
  getInventoryItems(tenantId: string): Promise<InventoryItem[]>;
  getInventoryItemsWithSuppliers(tenantId: string): Promise<any[]>;
  searchInventoryItems(tenantId: string, searchQuery: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string, tenantId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, tenantId: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string, tenantId: string): Promise<boolean>;
  
  // Purchase order operations
  getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, tenantId: string, order: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  
  // Purchase order item operations
  getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined>;
  
  // Inventory unit operations
  getInventoryUnits(inventoryItemId: string): Promise<InventoryUnit[]>;
  createInventoryUnit(unit: InsertInventoryUnit): Promise<InventoryUnit>;
  getInventoryUnitByTag(uniqueTag: string): Promise<InventoryUnit | undefined>;
  updateInventoryUnit(id: string, unit: Partial<InsertInventoryUnit>): Promise<InventoryUnit | undefined>;
  getAvailableInventoryUnits(inventoryItemId: string, quantity: number): Promise<InventoryUnit[]>;
  getInventoryUnitHistory(unitId: string, tenantId: string): Promise<any>;
  getInventoryItemUsageStats(inventoryItemId: string, tenantId: string): Promise<any>;
  
  // Ticket items operations
  getTicketItems(ticketId: string, tenantId: string): Promise<TicketItem[]>;
  createTicketItem(item: InsertTicketItem): Promise<TicketItem>;
  updateTicketItem(id: string, tenantId: string, item: Partial<InsertTicketItem>): Promise<TicketItem | undefined>;
  deleteTicketItem(id: string, tenantId: string): Promise<boolean>;
  deleteTicketItemsByTicketId(ticketId: string, tenantId: string): Promise<boolean>;
  
  // Transaction operations
  getTransactions(tenantId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  // Support operations
  getSupportTickets(tenantId: string): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  
  // Recent users for quick login
  getRecentUsers(limit: number): Promise<(User & { tenant?: Tenant })[]>;

  // Localization operations
  getLocalizations(language?: string): Promise<Localization[]>;
  getLocalizationsByKey(key: string): Promise<Localization[]>;
  createLocalization(localization: InsertLocalization): Promise<Localization>;
  updateLocalization(id: string, localization: Partial<InsertLocalization>): Promise<Localization | undefined>;
  
  // Auto-generated list operations
  getAutoGenList(category: string): Promise<AutoGenList | undefined>;
  getAutoGenListByType(listType: string): Promise<AutoGenList | undefined>;
  getAllAutoGenLists(): Promise<AutoGenList[]>;
  createAutoGenList(list: InsertAutoGenList): Promise<AutoGenList>;
  updateAutoGenList(id: string, list: Partial<InsertAutoGenList>): Promise<AutoGenList | undefined>;
  getAutoGenListsForUpdate(): Promise<AutoGenList[]>;
  
  // Device color operations
  getDeviceColors(deviceType: string, brand: string, model: string): Promise<DeviceColor | undefined>;
  createDeviceColor(deviceColor: InsertDeviceColor): Promise<DeviceColor>;
  updateDeviceColors(deviceType: string, brand: string, model: string, colors: string[], source: string): Promise<DeviceColor | undefined>;
  
  // Gamification operations
  getUserProgress(userId: string, tenantId: string): Promise<UserProgress | undefined>;
  createUserProgress(progress: InsertUserProgress): Promise<UserProgress>;
  updateUserProgress(userId: string, tenantId: string, progress: Partial<InsertUserProgress>): Promise<UserProgress | undefined>;
  addExperience(userId: string, tenantId: string, experience: number): Promise<UserProgress | undefined>;
  updateStreak(userId: string, tenantId: string): Promise<UserProgress | undefined>;
  
  getAchievements(): Promise<Achievement[]>;
  getAchievementsByCategory(category: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  
  getUserAchievements(userId: string, tenantId: string): Promise<(UserAchievement & { achievement: Achievement })[]>;
  unlockAchievement(userId: string, tenantId: string, achievementId: string): Promise<UserAchievement>;
  hasAchievement(userId: string, tenantId: string, achievementKey: string): Promise<boolean>;
  
  getUserActivities(userId: string, tenantId: string, limit?: number): Promise<UserActivity[]>;
  recordActivity(activity: InsertUserActivity): Promise<UserActivity>;
  getActivityStats(userId: string, tenantId: string, activityType?: string): Promise<{ count: number; totalExperience: number }>;
  
  // Issue assessment operations
  getIssueQuestions(deviceType: string): Promise<IssueQuestion[]>;
  createIssueResponse(response: InsertIssueResponse): Promise<IssueResponse>;
  getIssueResponses(ticketId: string): Promise<IssueResponse[]>;
  
  // Ticket notes operations
  getTicketNotes(ticketId: string, tenantId: string): Promise<TicketNote[]>;
  createTicketNote(note: InsertTicketNote): Promise<TicketNote>;
  
  // Store settings operations
  getStoreSettings(tenantId: string): Promise<StoreSettings | undefined>;
  createStoreSettings(settings: InsertStoreSettings): Promise<StoreSettings>;
  updateStoreSettings(tenantId: string, settings: Partial<InsertStoreSettings>): Promise<StoreSettings | undefined>;
  
  // Warranty tiers operations
  getWarrantyTiers(tenantId: string): Promise<WarrantyTier[]>;
  getWarrantyTiersByDeviceType(tenantId: string, deviceType: string): Promise<WarrantyTier[]>;
  createWarrantyTier(tier: InsertWarrantyTier): Promise<WarrantyTier>;
  updateWarrantyTier(id: string, tenantId: string, tier: Partial<InsertWarrantyTier>): Promise<WarrantyTier | undefined>;
  deleteWarrantyTier(id: string, tenantId: string): Promise<boolean>;
  
  // Repair services operations
  getRepairServices(tenantId: string): Promise<RepairService[]>;
  getRepairServicesByDeviceType(tenantId: string, deviceType: string): Promise<RepairService[]>;
  createRepairService(service: InsertRepairService): Promise<RepairService>;
  updateRepairService(id: string, tenantId: string, service: Partial<InsertRepairService>): Promise<RepairService | undefined>;
  deleteRepairService(id: string, tenantId: string): Promise<boolean>;
  
  // Possible defects operations
  getPossibleDefects(tenantId: string): Promise<PossibleDefect[]>;
  getPossibleDefectsByDeviceType(tenantId: string, deviceType: string): Promise<PossibleDefect[]>;
  createPossibleDefect(defect: InsertPossibleDefect): Promise<PossibleDefect>;
  updatePossibleDefect(id: string, tenantId: string, defect: Partial<InsertPossibleDefect>): Promise<PossibleDefect | undefined>;
  deletePossibleDefect(id: string, tenantId: string): Promise<boolean>;
  initializeDefaultDefects(tenantId: string): Promise<void>;
  
  // Checklists operations
  getChecklists(tenantId: string): Promise<Checklist[]>;
  getChecklistsByDeviceType(tenantId: string, deviceType: string): Promise<Checklist[]>;
  createChecklist(checklist: InsertChecklist): Promise<Checklist>;
  updateChecklist(id: string, tenantId: string, checklist: Partial<InsertChecklist>): Promise<Checklist | undefined>;
  deleteChecklist(id: string, tenantId: string): Promise<boolean>;
  initializeDefaultChecklists(tenantId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Health check implementation
  async healthCheck(): Promise<boolean> {
    try {
      await withRetry(async () => {
        const result = await db.execute(sql`SELECT 1 as health`);
        if (!result.rows || result.rows.length === 0) {
          throw new Error('Health check query returned no results');
        }
      });
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    });
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    return withRetry(async () => {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    });
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.domain, domain));
    return tenant;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }


  // Client operations
  async getClients(tenantId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.tenantId, tenantId));
  }

  async getClient(id: string, tenantId: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
    return client;
  }

  async getClientByCPF(tenantId: string, cpf: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.cpf, cpf)));
    return client;
  }

  async searchClients(tenantId: string, query: string): Promise<Client[]> {
    // Clean the query for CPF search (remove non-digits for CPF matching)
    const cleanQuery = query.replace(/\D/g, '');
    
    const searchConditions = [
      ilike(clients.firstName, `%${query}%`),
      ilike(clients.lastName, `%${query}%`),
      ilike(clients.email, `%${query}%`)
    ];

    // For CPF search, only use the cleaned digits version since CPFs are stored without formatting
    if (cleanQuery.length >= 3) {
      searchConditions.push(ilike(clients.cpf, `%${cleanQuery}%`));
    }
    
    return db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.tenantId, tenantId),
          or(...searchConditions)
        )
      )
      .orderBy(desc(clients.updatedAt))
      .limit(10);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(clientId: string, clientData: Partial<InsertClient>, tenantId: string): Promise<Client | null> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...clientData, updatedAt: new Date() })
      .where(and(eq(clients.id, clientId), eq(clients.tenantId, tenantId)))
      .returning();
    return updatedClient || null;
  }

  // Ticket operations
  async getTickets(tenantId: string): Promise<Ticket[]> {
    return db.select().from(tickets).where(eq(tickets.tenantId, tenantId));
  }

  async getTicketsWithClients(tenantId: string): Promise<(Ticket & { client?: Client })[]> {
    const results = await db
      .select({
        id: tickets.id,
        tenantId: tickets.tenantId,
        clientId: tickets.clientId,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        assignedTo: tickets.assignedTo,
        estimatedCost: tickets.estimatedCost,
        actualCost: tickets.actualCost,
        totalCost: tickets.actualCost,
        deviceType: tickets.deviceType,
        deviceModel: tickets.deviceModel,
        deviceColor: tickets.deviceColor,
        deviceMemory: tickets.deviceMemory,
        deviceStorageCapacity: tickets.deviceStorageCapacity,
        issueDescription: tickets.issueDescription,
        serviceChecklist: tickets.serviceChecklist,
        clientDeadline: tickets.clientDeadline,
        technicianEstimatedHours: tickets.technicianEstimatedHours,
        selectedServices: tickets.selectedServices,
        warrantyType: tickets.warrantyType,
        costEstimation: tickets.costEstimation,
        costExplanation: tickets.costExplanation,
        // Completion tracking fields
        completedAt: tickets.completedAt,
        completedBy: tickets.completedBy,
        finalActualCost: tickets.finalActualCost,
        completionNotes: tickets.completionNotes,
        actualHours: tickets.actualHours,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          cpf: clients.cpf,
          email: clients.email,
          phone: clients.phone,
          streetAddress: clients.streetAddress,
          streetNumber: clients.streetNumber,
          apartment: clients.apartment,
          birthday: clients.birthday,
          notes: clients.notes,
          tenantId: clients.tenantId,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt,
        },
      })
      .from(tickets)
      .leftJoin(clients, eq(tickets.clientId, clients.id))
      .where(eq(tickets.tenantId, tenantId));

    return results.map(row => ({
      ...row,
      client: row.client?.id ? row.client : undefined
    }));
  }

  async getTicketsByClientId(clientId: string, tenantId: string): Promise<Ticket[]> {
    return db
      .select()
      .from(tickets)
      .where(and(eq(tickets.clientId, clientId), eq(tickets.tenantId, tenantId)))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicket(id: string, tenantId: string): Promise<Ticket | undefined> {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), eq(tickets.tenantId, tenantId)));
    return ticket;
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [newTicket] = await db.insert(tickets).values(ticket).returning();
    return newTicket;
  }

  private async isTicketFinalized(ticketId: string, tenantId: string): Promise<boolean> {
    const [ticket] = await db
      .select({ status: tickets.status })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
      .limit(1);
    return ticket?.status === 'finalized';
  }

  async finalizeTicket(
    ticketId: string, 
    tenantId: string,
    completedBy: string,
    completionNotes: string,
    actualHours: number,
    finalActualCost: number
  ): Promise<Ticket | undefined> {
    // Check if ticket is already finalized
    if (await this.isTicketFinalized(ticketId, tenantId)) {
      throw new Error('Cannot modify finalized ticket');
    }

    // Get current ticket data for analytics calculation
    const currentTicket = await this.getTicket(ticketId, tenantId);
    if (!currentTicket) {
      throw new Error('Ticket not found');
    }

    const now = new Date();
    const [finalizedTicket] = await db
      .update(tickets)
      .set({ 
        status: 'finalized',
        completedAt: now,
        completedBy,
        completionNotes,
        actualHours,
        finalActualCost: finalActualCost.toString(),
        updatedAt: now
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
      .returning();

    // Create completion analytics record
    if (finalizedTicket) {
      await this.createCompletionAnalyticsRecord(finalizedTicket, actualHours, finalActualCost);
    }

    return finalizedTicket;
  }

  async updateTicketStatus(ticketId: string, status: string, tenantId: string): Promise<Ticket | undefined> {
    // Check if ticket is finalized and prevent changes (except when setting TO finalized)
    if (status !== 'finalized' && await this.isTicketFinalized(ticketId, tenantId)) {
      throw new Error('Cannot modify finalized ticket');
    }

    const [updatedTicket] = await db
      .update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
      .returning();
    return updatedTicket;
  }

  async updateTicketPriority(ticketId: string, priority: string, tenantId: string): Promise<Ticket | undefined> {
    // Prevent priority changes on finalized tickets
    if (await this.isTicketFinalized(ticketId, tenantId)) {
      throw new Error('Cannot modify finalized ticket');
    }

    const [updatedTicket] = await db
      .update(tickets)
      .set({ priority, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
      .returning();
    return updatedTicket;
  }

  async checkTicketIdExists(ticketId: string, tenantId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)));
    
    return result.count > 0;
  }

  async deleteTicket(ticketId: string, tenantId: string): Promise<boolean> {
    return withRetry(async () => {
      // First, verify ticket exists and belongs to tenant
      const ticket = await this.getTicket(ticketId, tenantId);
      if (!ticket) {
        return false;
      }

      // Prevent deletion of finalized tickets
      if (ticket.status === 'finalized') {
        throw new Error('Cannot delete finalized ticket');
      }

      // Delete associated data in order due to foreign key constraints
      // 1. Delete ticket notes
      await db
        .delete(ticketNotes)
        .where(and(eq(ticketNotes.ticketId, ticketId), eq(ticketNotes.tenantId, tenantId)));

      // 2. Delete issue responses
      await db
        .delete(issueResponses)
        .where(eq(issueResponses.ticketId, ticketId));

      // 3. Delete the ticket itself
      const result = await db
        .delete(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)));

      return (result.rowCount ?? 0) > 0;
    });
  }

  // Supplier operations
  async getSuppliers(tenantId: string): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.tenantId, tenantId)).orderBy(desc(suppliers.createdAt));
  }

  async getSupplier(id: string, tenantId: string): Promise<Supplier | undefined> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenantId)));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: string, tenantId: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenantId)))
      .returning();
    return updatedSupplier;
  }

  async deleteSupplier(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Inventory operations
  async getInventoryItems(tenantId: string): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
  }

  async getInventoryItemsWithSuppliers(tenantId: string): Promise<any[]> {
    const items = await db
      .select({
        id: inventoryItems.id,
        tenantId: inventoryItems.tenantId,
        supplierId: inventoryItems.supplierId,
        name: inventoryItems.name,
        description: inventoryItems.description,
        sku: inventoryItems.sku,
        brand: inventoryItems.brand,
        model: inventoryItems.model,
        itemType: inventoryItems.itemType,
        deviceType: inventoryItems.deviceType,
        quantity: inventoryItems.quantity,
        minQuantity: inventoryItems.minQuantity,
        cost: inventoryItems.cost,
        price: inventoryItems.price,
        supplier: inventoryItems.supplier,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        supplierName: suppliers.name,
      })
      .from(inventoryItems)
      .leftJoin(suppliers, eq(inventoryItems.supplierId, suppliers.id))
      .where(eq(inventoryItems.tenantId, tenantId));
    
    return items;
  }

  async searchInventoryItems(tenantId: string, searchQuery: string): Promise<InventoryItem[]> {
    const lowerQuery = searchQuery.toLowerCase();
    
    // Extract ticket ID if the query looks like "TK-XXXXXX" format
    const ticketIdMatch = lowerQuery.match(/^(?:tk-)?([a-f0-9]+)$/i);
    const ticketId = ticketIdMatch ? ticketIdMatch[1] : null;
    
    // Search for items matching name or ID
    const directMatches = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.tenantId, tenantId),
          or(
            sql`LOWER(${inventoryItems.name}) LIKE ${`%${lowerQuery}%`}`,
            sql`LOWER(${inventoryItems.id}) LIKE ${`%${lowerQuery}%`}`
          )
        )
      );
    
    // Search for items by unit tag
    const unitTagMatches = await db
      .selectDistinct({ 
        id: inventoryItems.id,
        tenantId: inventoryItems.tenantId,
        supplierId: inventoryItems.supplierId,
        name: inventoryItems.name,
        description: inventoryItems.description,
        sku: inventoryItems.sku,
        category: inventoryItems.category,
        brand: inventoryItems.brand,
        model: inventoryItems.model,
        itemType: inventoryItems.itemType,
        deviceType: inventoryItems.deviceType,
        quantity: inventoryItems.quantity,
        minQuantity: inventoryItems.minQuantity,
        cost: inventoryItems.cost,
        price: inventoryItems.price,
        supplier: inventoryItems.supplier,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .innerJoin(inventoryUnits, eq(inventoryUnits.inventoryItemId, inventoryItems.id))
      .where(
        and(
          eq(inventoryItems.tenantId, tenantId),
          sql`LOWER(${inventoryUnits.uniqueTag}) LIKE ${`%${lowerQuery}%`}`
        )
      );
    
    // Search for items by ticket ID (if query looks like a ticket ID)
    let ticketMatches: InventoryItem[] = [];
    if (ticketId) {
      ticketMatches = await db
        .selectDistinct({
          id: inventoryItems.id,
          tenantId: inventoryItems.tenantId,
          supplierId: inventoryItems.supplierId,
          name: inventoryItems.name,
          description: inventoryItems.description,
          sku: inventoryItems.sku,
          category: inventoryItems.category,
          brand: inventoryItems.brand,
          model: inventoryItems.model,
          itemType: inventoryItems.itemType,
          deviceType: inventoryItems.deviceType,
          quantity: inventoryItems.quantity,
          minQuantity: inventoryItems.minQuantity,
          cost: inventoryItems.cost,
          price: inventoryItems.price,
          supplier: inventoryItems.supplier,
          createdAt: inventoryItems.createdAt,
          updatedAt: inventoryItems.updatedAt,
        })
        .from(inventoryItems)
        .innerJoin(inventoryUnits, eq(inventoryUnits.inventoryItemId, inventoryItems.id))
        .innerJoin(tickets, eq(inventoryUnits.ticketId, tickets.id))
        .where(
          and(
            eq(inventoryItems.tenantId, tenantId),
            sql`LOWER(${tickets.id}) LIKE ${`%${ticketId}%`}`
          )
        );
    }
    
    // Merge and deduplicate results
    const allMatches = [...directMatches, ...unitTagMatches, ...ticketMatches];
    const uniqueItems = Array.from(
      new Map(allMatches.map(item => [item.id, item])).values()
    );
    
    return uniqueItems;
  }

  async getInventoryItem(id: string, tenantId: string): Promise<InventoryItem | undefined> {
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)));
    return item;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [newItem] = await db.insert(inventoryItems).values(item).returning();
    return newItem;
  }

  async updateInventoryItem(id: string, tenantId: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [updatedItem] = await db
      .update(inventoryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)))
      .returning();
    return updatedItem;
  }

  async deleteInventoryItem(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Purchase order operations
  async getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]> {
    return db.select().from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId)).orderBy(desc(purchaseOrders.createdAt));
  }

  async getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder | undefined> {
    const [order] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
    return order;
  }

  async createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [newOrder] = await db.insert(purchaseOrders).values(order).returning();
    return newOrder;
  }

  async updatePurchaseOrder(id: string, tenantId: string, order: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [updatedOrder] = await db
      .update(purchaseOrders)
      .set({ ...order, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
      .returning();
    return updatedOrder;
  }

  // Purchase order item operations
  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [newItem] = await db.insert(purchaseOrderItems).values(item).returning();
    return newItem;
  }

  async updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    const [updatedItem] = await db
      .update(purchaseOrderItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return updatedItem;
  }

  // Inventory unit operations
  async getInventoryUnits(inventoryItemId: string): Promise<InventoryUnit[]> {
    return db.select().from(inventoryUnits).where(eq(inventoryUnits.inventoryItemId, inventoryItemId));
  }

  async createInventoryUnit(unit: InsertInventoryUnit): Promise<InventoryUnit> {
    const [newUnit] = await db.insert(inventoryUnits).values(unit).returning();
    return newUnit;
  }

  async getInventoryUnitByTag(uniqueTag: string): Promise<InventoryUnit | undefined> {
    const [unit] = await db
      .select()
      .from(inventoryUnits)
      .where(eq(inventoryUnits.uniqueTag, uniqueTag));
    return unit;
  }

  async updateInventoryUnit(id: string, unit: Partial<InsertInventoryUnit>): Promise<InventoryUnit | undefined> {
    const [updatedUnit] = await db
      .update(inventoryUnits)
      .set(unit)
      .where(eq(inventoryUnits.id, id))
      .returning();
    return updatedUnit;
  }

  async getAvailableInventoryUnits(inventoryItemId: string, quantity: number): Promise<InventoryUnit[]> {
    return db
      .select()
      .from(inventoryUnits)
      .where(
        and(
          eq(inventoryUnits.inventoryItemId, inventoryItemId),
          eq(inventoryUnits.status, 'in_stock')
        )
      )
      .limit(quantity);
  }

  async getInventoryUnitHistory(unitId: string, tenantId: string): Promise<any> {
    const result = await db
      .select({
        unit: inventoryUnits,
        inventoryItem: {
          id: inventoryItems.id,
          name: inventoryItems.name,
          sku: inventoryItems.sku,
          category: inventoryItems.category,
          tenantId: inventoryItems.tenantId,
        },
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          tenantId: suppliers.tenantId,
        },
        ticket: {
          id: tickets.id,
          deviceType: tickets.deviceType,
          deviceModel: tickets.deviceModel,
          status: tickets.status,
          completedAt: tickets.completedAt,
          tenantId: tickets.tenantId,
        },
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          tenantId: clients.tenantId,
        },
      })
      .from(inventoryUnits)
      .leftJoin(inventoryItems, eq(inventoryUnits.inventoryItemId, inventoryItems.id))
      .leftJoin(suppliers, eq(inventoryUnits.supplierId, suppliers.id))
      .leftJoin(tickets, eq(inventoryUnits.ticketId, tickets.id))
      .leftJoin(clients, eq(tickets.clientId, clients.id))
      .where(
        and(
          eq(inventoryUnits.id, unitId),
          eq(inventoryItems.tenantId, tenantId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async getInventoryItemUsageStats(inventoryItemId: string, tenantId: string): Promise<any> {
    // Get inventory item details first to verify tenant ownership
    const inventoryItem = await this.getInventoryItem(inventoryItemId, tenantId);
    
    if (!inventoryItem) {
      return null;
    }

    // Get all units for this inventory item that have been used
    const usedUnits = await db
      .select({
        unit: inventoryUnits,
        ticket: {
          id: tickets.id,
          deviceType: tickets.deviceType,
          deviceModel: tickets.deviceModel,
          status: tickets.status,
          completedAt: tickets.completedAt,
        },
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
        },
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(inventoryUnits)
      .leftJoin(tickets, eq(inventoryUnits.ticketId, tickets.id))
      .leftJoin(clients, eq(tickets.clientId, clients.id))
      .leftJoin(suppliers, eq(inventoryUnits.supplierId, suppliers.id))
      .where(
        and(
          eq(inventoryUnits.inventoryItemId, inventoryItemId),
          eq(inventoryUnits.status, 'used')
        )
      )
      .orderBy(desc(inventoryUnits.usedAt));

    return {
      inventoryItem,
      usageHistory: usedUnits,
      totalUsed: usedUnits.length,
    };
  }

  // Ticket items operations
  async getTicketItems(ticketId: string, tenantId: string): Promise<any[]> {
    const items = await db
      .select({
        id: ticketItems.id,
        tenantId: ticketItems.tenantId,
        ticketId: ticketItems.ticketId,
        inventoryItemId: ticketItems.inventoryItemId,
        quantity: ticketItems.quantity,
        unitPrice: ticketItems.unitPrice,
        totalPrice: ticketItems.totalPrice,
        inventoryUnitIds: ticketItems.inventoryUnitIds,
        confirmed: ticketItems.confirmed,
        createdAt: ticketItems.createdAt,
        updatedAt: ticketItems.updatedAt,
        inventoryItem: {
          id: inventoryItems.id,
          name: inventoryItems.name,
          sku: inventoryItems.sku,
        },
      })
      .from(ticketItems)
      .leftJoin(inventoryItems, eq(ticketItems.inventoryItemId, inventoryItems.id))
      .where(and(eq(ticketItems.ticketId, ticketId), eq(ticketItems.tenantId, tenantId)));
    
    // For each item, fetch the unit tags
    const itemsWithTags = await Promise.all(items.map(async (item) => {
      const unitIds = item.inventoryUnitIds as string[] | null;
      if (unitIds && unitIds.length > 0) {
        const units = await db
          .select({
            id: inventoryUnits.id,
            uniqueTag: inventoryUnits.uniqueTag,
          })
          .from(inventoryUnits)
          .where(inArray(inventoryUnits.id, unitIds));
        
        return {
          ...item,
          units: units,
        };
      }
      return {
        ...item,
        units: [],
      };
    }));
    
    return itemsWithTags;
  }

  async createTicketItem(item: InsertTicketItem): Promise<TicketItem> {
    const [newItem] = await db.insert(ticketItems).values(item).returning();
    return newItem;
  }

  async updateTicketItem(id: string, tenantId: string, item: Partial<InsertTicketItem>): Promise<TicketItem | undefined> {
    const [updatedItem] = await db
      .update(ticketItems)
      .set({ ...item, updatedAt: new Date() })
      .where(and(eq(ticketItems.id, id), eq(ticketItems.tenantId, tenantId)))
      .returning();
    return updatedItem;
  }

  async deleteTicketItem(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(ticketItems)
      .where(and(eq(ticketItems.id, id), eq(ticketItems.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteTicketItemsByTicketId(ticketId: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(ticketItems)
      .where(and(eq(ticketItems.ticketId, ticketId), eq(ticketItems.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Transaction operations
  async getTransactions(tenantId: string): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.tenantId, tenantId));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  // Support operations
  async getSupportTickets(tenantId: string): Promise<SupportTicket[]> {
    return db.select().from(supportTickets).where(eq(supportTickets.tenantId, tenantId));
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [newTicket] = await db.insert(supportTickets).values(ticket).returning();
    return newTicket;
  }

  // Ticket notes operations
  async getTicketNotes(ticketId: string, tenantId: string): Promise<TicketNote[]> {
    return db
      .select()
      .from(ticketNotes)
      .where(and(eq(ticketNotes.ticketId, ticketId), eq(ticketNotes.tenantId, tenantId)))
      .orderBy(desc(ticketNotes.createdAt));
  }

  async createTicketNote(note: InsertTicketNote): Promise<TicketNote> {
    const [newNote] = await db.insert(ticketNotes).values(note).returning();
    return newNote;
  }

  // Get recent users for quick login display
  async getRecentUsers(limit: number): Promise<(User & { tenant?: Tenant })[]> {
    const usersWithTenants = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        tenantId: users.tenantId,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        tenant: {
          id: tenants.id,
          domain: tenants.domain,
          settings: tenants.settings,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
        },
      })
      .from(users)
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .orderBy(desc(users.updatedAt))
      .limit(limit);

    return usersWithTenants.map(row => ({
      ...row,
      tenant: row.tenant?.id ? row.tenant : undefined
    }));
  }

  // Localization operations
  async getLocalizations(language?: string): Promise<Localization[]> {
    if (language) {
      return db.select().from(localizations).where(eq(localizations.language, language));
    }
    return db.select().from(localizations);
  }

  async getLocalizationsByKey(key: string): Promise<Localization[]> {
    return db.select().from(localizations).where(eq(localizations.key, key));
  }

  async createLocalization(localization: InsertLocalization): Promise<Localization> {
    const [newLocalization] = await db.insert(localizations).values(localization).returning();
    return newLocalization;
  }

  async updateLocalization(id: string, localization: Partial<InsertLocalization>): Promise<Localization | undefined> {
    const [updatedLocalization] = await db
      .update(localizations)
      .set({ ...localization, updatedAt: new Date() })
      .where(eq(localizations.id, id))
      .returning();
    return updatedLocalization;
  }

  // Auto-generated list operations
  async getAutoGenList(category: string): Promise<AutoGenList | undefined> {
    return withRetry(async () => {
      // Look specifically for brand lists for the given category
      const [list] = await db
        .select()
        .from(autoGenLists)
        .where(and(
          eq(autoGenLists.listType, `AutoGen-List-Brands-${category}`),
          eq(autoGenLists.isActive, true)
        ));
      return list;
    });
  }

  async getAutoGenListByType(listType: string): Promise<AutoGenList | undefined> {
    return withRetry(async () => {
      const [list] = await db
        .select()
        .from(autoGenLists)
        .where(and(
          eq(autoGenLists.listType, listType),
          eq(autoGenLists.isActive, true)
        ));
      return list;
    });
  }

  async getAllAutoGenLists(): Promise<AutoGenList[]> {
    return withRetry(async () => {
      console.log('🔍 Storage: Fetching all auto-gen lists...');
      const result = await db
        .select()
        .from(autoGenLists)
        .where(eq(autoGenLists.isActive, true))
        .orderBy(asc(autoGenLists.category), desc(autoGenLists.lastGenerated));
      console.log(`🔍 Storage: Found ${result.length} auto-gen lists`);
      return result;
    });
  }

  async createAutoGenList(list: InsertAutoGenList): Promise<AutoGenList> {
    return withRetry(async () => {
      const [newList] = await db.insert(autoGenLists).values(list).returning();
      return newList;
    });
  }

  async updateAutoGenList(id: string, list: Partial<InsertAutoGenList>): Promise<AutoGenList | undefined> {
    return withRetry(async () => {
      const [updatedList] = await db
        .update(autoGenLists)
        .set({ ...list, updatedAt: new Date() })
        .where(eq(autoGenLists.id, id))
        .returning();
      return updatedList;
    });
  }

  async getAutoGenListsForUpdate(): Promise<AutoGenList[]> {
    return withRetry(async () => {
      return db
        .select()
        .from(autoGenLists)
        .where(and(
          eq(autoGenLists.isActive, true),
          sql`${autoGenLists.nextUpdate} <= NOW()`
        ));
    });
  }

  // Device color methods implementation
  async getDeviceColors(deviceType: string, brand: string, model: string): Promise<DeviceColor | undefined> {
    return withRetry(async () => {
      const [deviceColor] = await db
        .select()
        .from(deviceColors)
        .where(and(
          ilike(deviceColors.deviceType, deviceType),
          ilike(deviceColors.brand, brand),
          ilike(deviceColors.model, model)
        ));
      return deviceColor;
    });
  }

  async createDeviceColor(deviceColor: InsertDeviceColor): Promise<DeviceColor> {
    return withRetry(async () => {
      const [newDeviceColor] = await db.insert(deviceColors).values(deviceColor).returning();
      return newDeviceColor;
    });
  }

  async updateDeviceColors(deviceType: string, brand: string, model: string, colors: string[], source: string): Promise<DeviceColor | undefined> {
    return withRetry(async () => {
      const [updatedDeviceColor] = await db
        .update(deviceColors)
        .set({ 
          colors, 
          source, 
          lastUpdated: new Date() 
        })
        .where(and(
          ilike(deviceColors.deviceType, deviceType),
          ilike(deviceColors.brand, brand),
          ilike(deviceColors.model, model)
        ))
        .returning();
      return updatedDeviceColor;
    });
  }

  // Device Checklist Templates
  async getDeviceChecklistTemplate(deviceType: string): Promise<DeviceChecklistTemplate | undefined> {
    return withRetry(async () => {
      const [template] = await db
        .select()
        .from(deviceChecklistTemplates)
        .where(and(
          eq(deviceChecklistTemplates.deviceType, deviceType),
          eq(deviceChecklistTemplates.isActive, true)
        ));
      return template;
    });
  }

  async createDeviceChecklistTemplate(template: InsertDeviceChecklistTemplate): Promise<DeviceChecklistTemplate> {
    return withRetry(async () => {
      const [newTemplate] = await db.insert(deviceChecklistTemplates).values(template).returning();
      return newTemplate;
    });
  }

  async updateDeviceChecklistTemplate(deviceType: string, components: string[]): Promise<DeviceChecklistTemplate | undefined> {
    return withRetry(async () => {
      const [updatedTemplate] = await db
        .update(deviceChecklistTemplates)
        .set({ 
          components,
          updatedAt: new Date() 
        })
        .where(eq(deviceChecklistTemplates.deviceType, deviceType))
        .returning();
      return updatedTemplate;
    });
  }

  async getAllDeviceChecklistTemplates(): Promise<DeviceChecklistTemplate[]> {
    return withRetry(async () => {
      const templates = await db
        .select()
        .from(deviceChecklistTemplates)
        .where(eq(deviceChecklistTemplates.isActive, true))
        .orderBy(asc(deviceChecklistTemplates.deviceType));
      return templates;
    });
  }

  // Gamification methods implementation
  async getUserProgress(userId: string, tenantId: string): Promise<UserProgress | undefined> {
    return withRetry(async () => {
      const [progress] = await db
        .select()
        .from(userProgress)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.tenantId, tenantId)));
      return progress;
    });
  }

  async createUserProgress(progress: InsertUserProgress): Promise<UserProgress> {
    return withRetry(async () => {
      const [newProgress] = await db
        .insert(userProgress)
        .values(progress)
        .returning();
      return newProgress;
    });
  }

  async updateUserProgress(userId: string, tenantId: string, progress: Partial<InsertUserProgress>): Promise<UserProgress | undefined> {
    return withRetry(async () => {
      const [updated] = await db
        .update(userProgress)
        .set({ ...progress, updatedAt: new Date() })
        .where(and(eq(userProgress.userId, userId), eq(userProgress.tenantId, tenantId)))
        .returning();
      return updated;
    });
  }

  async addExperience(userId: string, tenantId: string, experience: number): Promise<UserProgress | undefined> {
    return withRetry(async () => {
      // Get current progress or create new one
      let progress = await this.getUserProgress(userId, tenantId);
      
      if (!progress) {
        progress = await this.createUserProgress({
          userId,
          tenantId,
          experience,
          totalActions: 1,
        });
      } else {
        const newExperience = progress.experience + experience;
        const newLevel = Math.floor(newExperience / 100) + 1; // 100 XP per level
        
        progress = await this.updateUserProgress(userId, tenantId, {
          experience: newExperience,
          level: newLevel,
          totalActions: progress.totalActions + 1,
        });
      }
      
      return progress;
    });
  }

  async updateStreak(userId: string, tenantId: string): Promise<UserProgress | undefined> {
    return withRetry(async () => {
      const progress = await this.getUserProgress(userId, tenantId);
      if (!progress) return undefined;

      const today = new Date();
      const lastActive = progress.lastActiveDate ? new Date(progress.lastActiveDate) : null;
      
      let newStreak = progress.streakDays;
      
      if (lastActive) {
        const daysDiff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day, increment streak
          newStreak = progress.streakDays + 1;
        } else if (daysDiff > 1) {
          // Missed days, reset streak
          newStreak = 1;
        }
        // If daysDiff === 0, same day, keep current streak
      } else {
        // First time, start streak
        newStreak = 1;
      }

      return await this.updateUserProgress(userId, tenantId, {
        streakDays: newStreak,
        lastActiveDate: today,
      });
    });
  }

  async getAchievements(): Promise<Achievement[]> {
    return withRetry(async () => {
      return await db.select().from(achievements).orderBy(asc(achievements.category), asc(achievements.requiredValue));
    });
  }

  async getAchievementsByCategory(category: string): Promise<Achievement[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(achievements)
        .where(eq(achievements.category, category))
        .orderBy(asc(achievements.requiredValue));
    });
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    return withRetry(async () => {
      const [newAchievement] = await db
        .insert(achievements)
        .values(achievement)
        .returning();
      return newAchievement;
    });
  }

  async getUserAchievements(userId: string, tenantId: string): Promise<(UserAchievement & { achievement: Achievement })[]> {
    return withRetry(async () => {
      const result = await db
        .select({
          id: userAchievements.id,
          userId: userAchievements.userId,
          tenantId: userAchievements.tenantId,
          achievementId: userAchievements.achievementId,
          unlockedAt: userAchievements.unlockedAt,
          achievement: achievements,
        })
        .from(userAchievements)
        .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
        .where(and(eq(userAchievements.userId, userId), eq(userAchievements.tenantId, tenantId)))
        .orderBy(desc(userAchievements.unlockedAt));
      
      return result.map(row => ({
        ...row,
        achievement: row.achievement,
      })) as (UserAchievement & { achievement: Achievement })[];
    });
  }

  async unlockAchievement(userId: string, tenantId: string, achievementId: string): Promise<UserAchievement> {
    return withRetry(async () => {
      const [unlock] = await db
        .insert(userAchievements)
        .values({ userId, tenantId, achievementId })
        .returning();
      return unlock;
    });
  }

  async hasAchievement(userId: string, tenantId: string, achievementKey: string): Promise<boolean> {
    return withRetry(async () => {
      const result = await db
        .select({ id: userAchievements.id })
        .from(userAchievements)
        .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
        .where(and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.tenantId, tenantId),
          eq(achievements.key, achievementKey)
        ))
        .limit(1);
      
      return result.length > 0;
    });
  }

  async getUserActivities(userId: string, tenantId: string, limit = 50): Promise<UserActivity[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(userActivities)
        .where(and(eq(userActivities.userId, userId), eq(userActivities.tenantId, tenantId)))
        .orderBy(desc(userActivities.createdAt))
        .limit(limit);
    });
  }

  async recordActivity(activity: InsertUserActivity): Promise<UserActivity> {
    return withRetry(async () => {
      const [newActivity] = await db
        .insert(userActivities)
        .values(activity)
        .returning();
      
      // Add experience to user progress
      if (activity.experienceGained && activity.experienceGained > 0) {
        await this.addExperience(activity.userId, activity.tenantId, activity.experienceGained);
      }
      
      // Update daily streak
      await this.updateStreak(activity.userId, activity.tenantId);
      
      return newActivity;
    });
  }

  async getActivityStats(userId: string, tenantId: string, activityType?: string): Promise<{ count: number; totalExperience: number }> {
    return withRetry(async () => {
      const conditions = [
        eq(userActivities.userId, userId),
        eq(userActivities.tenantId, tenantId),
      ];
      
      if (activityType) {
        conditions.push(eq(userActivities.activityType, activityType));
      }
      
      const result = await db
        .select({
          count: sql<number>`count(*)`,
          totalExperience: sql<number>`sum(${userActivities.experienceGained})`,
        })
        .from(userActivities)
        .where(and(...conditions));
      
      return {
        count: Number(result[0]?.count || 0),
        totalExperience: Number(result[0]?.totalExperience || 0),
      };
    });
  }

  // Issue assessment implementations
  async getIssueQuestions(deviceType: string): Promise<IssueQuestion[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(issueQuestions)
        .where(eq(issueQuestions.deviceType, deviceType))
        .orderBy(asc(issueQuestions.questionOrder));
    });
  }

  async createIssueResponse(response: InsertIssueResponse): Promise<IssueResponse> {
    return withRetry(async () => {
      const [newResponse] = await db
        .insert(issueResponses)
        .values(response)
        .returning();
      return newResponse;
    });
  }

  async getIssueResponses(ticketId: string): Promise<IssueResponse[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(issueResponses)
        .where(eq(issueResponses.ticketId, ticketId));
    });
  }

  // Store settings implementations
  async getStoreSettings(tenantId: string): Promise<StoreSettings | undefined> {
    return withRetry(async () => {
      const [settings] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.tenantId, tenantId));
      return settings;
    });
  }

  async createStoreSettings(settings: InsertStoreSettings): Promise<StoreSettings> {
    return withRetry(async () => {
      const [newSettings] = await db
        .insert(storeSettings)
        .values(settings)
        .returning();
      return newSettings;
    });
  }

  async updateStoreSettings(tenantId: string, settings: Partial<InsertStoreSettings>): Promise<StoreSettings | undefined> {
    return withRetry(async () => {
      const [updatedSettings] = await db
        .update(storeSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(storeSettings.tenantId, tenantId))
        .returning();
      return updatedSettings;
    });
  }

  // Warranty tiers implementations
  async getWarrantyTiers(tenantId: string): Promise<WarrantyTier[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(warrantyTiers)
        .where(eq(warrantyTiers.tenantId, tenantId))
        .orderBy(asc(warrantyTiers.deviceType), asc(warrantyTiers.tierType));
    });
  }

  async getWarrantyTiersByDeviceType(tenantId: string, deviceType: string): Promise<WarrantyTier[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(warrantyTiers)
        .where(and(
          eq(warrantyTiers.tenantId, tenantId),
          eq(warrantyTiers.deviceType, deviceType),
          eq(warrantyTiers.isActive, true)
        ))
        .orderBy(asc(warrantyTiers.tierType));
    });
  }

  async createWarrantyTier(tier: InsertWarrantyTier): Promise<WarrantyTier> {
    return withRetry(async () => {
      const [newTier] = await db
        .insert(warrantyTiers)
        .values(tier)
        .returning();
      return newTier;
    });
  }

  async updateWarrantyTier(id: string, tenantId: string, tier: Partial<InsertWarrantyTier>): Promise<WarrantyTier | undefined> {
    return withRetry(async () => {
      const [updatedTier] = await db
        .update(warrantyTiers)
        .set({ ...tier, updatedAt: new Date() })
        .where(and(
          eq(warrantyTiers.id, id),
          eq(warrantyTiers.tenantId, tenantId)
        ))
        .returning();
      return updatedTier;
    });
  }

  async deleteWarrantyTier(id: string, tenantId: string): Promise<boolean> {
    return withRetry(async () => {
      const result = await db
        .delete(warrantyTiers)
        .where(and(
          eq(warrantyTiers.id, id),
          eq(warrantyTiers.tenantId, tenantId)
        ));
      return (result.rowCount ?? 0) > 0;
    });
  }

  // Repair services implementations
  async getRepairServices(tenantId: string): Promise<RepairService[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(repairServices)
        .where(eq(repairServices.tenantId, tenantId))
        .orderBy(asc(repairServices.deviceType), asc(repairServices.name));
    });
  }

  async getRepairServicesByDeviceType(tenantId: string, deviceType: string): Promise<RepairService[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(repairServices)
        .where(and(
          eq(repairServices.tenantId, tenantId),
          eq(repairServices.deviceType, deviceType),
          eq(repairServices.isActive, true)
        ))
        .orderBy(asc(repairServices.name));
    });
  }

  async createRepairService(service: InsertRepairService): Promise<RepairService> {
    return withRetry(async () => {
      const [newService] = await db
        .insert(repairServices)
        .values(service)
        .returning();
      return newService;
    });
  }

  async updateRepairService(id: string, tenantId: string, service: Partial<InsertRepairService>): Promise<RepairService | undefined> {
    return withRetry(async () => {
      const [updatedService] = await db
        .update(repairServices)
        .set({ ...service, updatedAt: new Date() })
        .where(and(
          eq(repairServices.id, id),
          eq(repairServices.tenantId, tenantId)
        ))
        .returning();
      return updatedService;
    });
  }

  async deleteRepairService(id: string, tenantId: string): Promise<boolean> {
    return withRetry(async () => {
      const result = await db
        .delete(repairServices)
        .where(and(
          eq(repairServices.id, id),
          eq(repairServices.tenantId, tenantId)
        ));
      return (result.rowCount ?? 0) > 0;
    });
  }

  // Possible defects implementations
  async getPossibleDefects(tenantId: string): Promise<PossibleDefect[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(possibleDefects)
        .where(eq(possibleDefects.tenantId, tenantId))
        .orderBy(asc(possibleDefects.deviceType), asc(possibleDefects.name));
    });
  }

  async getPossibleDefectsByDeviceType(tenantId: string | null, deviceType: string): Promise<PossibleDefect[]> {
    return withRetry(async () => {
      const conditions = [
        eq(possibleDefects.deviceType, deviceType),
        eq(possibleDefects.isActive, true)
      ];
      
      // Only add tenantId filter if it's provided
      if (tenantId !== null) {
        conditions.push(eq(possibleDefects.tenantId, tenantId));
      }
      
      return await db
        .select()
        .from(possibleDefects)
        .where(and(...conditions))
        .orderBy(asc(possibleDefects.name));
    });
  }

  async createPossibleDefect(defect: InsertPossibleDefect): Promise<PossibleDefect> {
    return withRetry(async () => {
      const [newDefect] = await db
        .insert(possibleDefects)
        .values(defect)
        .returning();
      return newDefect;
    });
  }

  async updatePossibleDefect(id: string, tenantId: string, defect: Partial<InsertPossibleDefect>): Promise<PossibleDefect | undefined> {
    return withRetry(async () => {
      const [updatedDefect] = await db
        .update(possibleDefects)
        .set({ ...defect, updatedAt: new Date() })
        .where(and(
          eq(possibleDefects.id, id),
          eq(possibleDefects.tenantId, tenantId)
        ))
        .returning();
      return updatedDefect;
    });
  }

  async deletePossibleDefect(id: string, tenantId: string): Promise<boolean> {
    return withRetry(async () => {
      const result = await db
        .delete(possibleDefects)
        .where(and(
          eq(possibleDefects.id, id),
          eq(possibleDefects.tenantId, tenantId)
        ));
      return (result.rowCount ?? 0) > 0;
    });
  }

  async initializeDefaultDefects(tenantId: string): Promise<void> {
    console.log(`🔧 Initializing default defects for tenant: ${tenantId}`);
    
    try {
      // Check if defects already exist for this tenant to ensure idempotency
      const existingDefects = await this.getPossibleDefects(tenantId);
      if (existingDefects.length > 0) {
        console.log(`📋 Tenant ${tenantId} already has ${existingDefects.length} defects, skipping initialization`);
        return;
      }

      // Phone defects (24 items)
      const phoneDefects = [
        "Tela quebrada", "Aparelho não liga", "Bateria viciada", "Conector de carga defeituoso",
        "Câmera com defeito", "Alto-falante não funciona", "Microfone com problemas", "Botão de volume travado",
        "Botão liga/desliga defeituoso", "Wi-Fi não conecta", "Bluetooth com problemas", "Dano por água",
        "Aplicativos travando", "Reinicializações constantes", "Touchscreen não responde", "Display com rachaduras",
        "Superaquecimento", "Placa-mãe danificada", "Entrada de fone defeituosa", "Sensor de proximidade com problema",
        "Câmera frontal não funciona", "Flash não acende", "Vibração não funciona", "Biometria não reconhece"
      ];

      // Laptop defects (24 items)
      const laptopDefects = [
        "Superaquecimento excessivo", "Bateria não carrega", "Tela com defeito", "Fonte de alimentação queimada",
        "Lentidão extrema", "Placa-mãe danificada", "HD com defeito", "Teclado com teclas travadas",
        "Touchpad não funciona", "Pixels mortos na tela", "Tela piscando", "Linhas na tela",
        "Cores distorcidas", "Cooler com ruído", "Pasta térmica ressecada", "LED de energia piscando",
        "Ruídos na fonte", "Bad blocks no HD", "Tela azul frequente", "Erro de boot",
        "Memória RAM defeituosa", "Dobradiça quebrada", "Ventilador parado", "Portas USB sem função"
      ];

      // Desktop defects (24 items)  
      const desktopDefects = [
        "Fonte queimada", "Placa-mãe em curto", "Desligamentos repentinos", "HD com ruídos estranhos",
        "Problemas de inicialização", "Perda de dados", "Artefatos na tela", "Placa de vídeo defeituosa",
        "Monitor sem imagem", "Tela azul da morte", "Memória RAM com erro", "Travamentos constantes",
        "Ventoinhas barulhentas", "Ruídos metálicos", "Portas USB não funcionam", "Rede sem conexão",
        "Periféricos não reconhecidos", "Processador superaquecendo", "BIOS corrompida", "Cabo de dados defeituoso",
        "Placa de som sem áudio", "Leitor de CD/DVD travado", "Gabinete com vibração excessiva", "Cooler do processador parado"
      ];

      // Create all defects using batch insert for better performance
      const allDefects = [
        ...phoneDefects.map(name => ({ tenantId, deviceType: 'Phone', name, isActive: true })),
        ...laptopDefects.map(name => ({ tenantId, deviceType: 'Laptop', name, isActive: true })),
        ...desktopDefects.map(name => ({ tenantId, deviceType: 'Desktop', name, isActive: true }))
      ];

      console.log(`📝 Creating ${allDefects.length} default defects for tenant ${tenantId}`);
      
      // Insert all defects in batches to avoid overwhelming the database
      await withRetry(async () => {
        await db.insert(possibleDefects).values(allDefects);
      });

      console.log(`✅ Successfully initialized ${allDefects.length} default defects for tenant ${tenantId}`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize default defects for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async initializeDefaultChecklists(tenantId: string): Promise<void> {
    console.log(`🔧 Initializing default checklists for tenant: ${tenantId}`);
    
    try {
      // Check if checklists already exist for this tenant
      const existingChecklists = await this.getChecklists(tenantId);
      if (existingChecklists.length > 0) {
        // Check if existing checklists are in English (need updating to Portuguese)
        const hasEnglishChecklists = existingChecklists.some(checklist => 
          checklist.name.includes('Audio System Check') || 
          checklist.name.includes('Button Operation Test') ||
          checklist.name.includes('Physical Condition Assessment') ||
          checklist.name.includes('Power Supply Unit (PSU) Test') ||
          checklist.name.includes('Audio and Microphone Check')
        );
        
        if (hasEnglishChecklists) {
          console.log(`🔄 Updating ${existingChecklists.length} existing English checklists to Portuguese for tenant ${tenantId}`);
          await this.updateChecklistsToPortuguese(tenantId);
          return;
        } else {
          console.log(`📋 Tenant ${tenantId} already has ${existingChecklists.length} checklists, checking for Portuguese conversion...`);
          // Force update check - if any English names exist, update them
          await this.updateChecklistsToPortuguese(tenantId);
          return;
        }
      }

      // Phone checklists (15 items)
      const phoneChecklists = [
        "Inspeção das condições físicas", "Teste de funcionalidade da tela", "Verificação de responsividade do touch", "Teste do botão home/liga",
        "Funcionalidade dos botões de volume", "Teste do alto-falante", "Teste do microfone", "Verificação da funcionalidade da câmera",
        "Teste de operação do flash", "Teste de conectividade Wi-Fi", "Teste de conectividade Bluetooth", "Inspeção da porta de carregamento",
        "Teste de desempenho da bateria", "Teste do sensor de impressão digital", "Verificação geral de desempenho do aparelho"
      ];

      // Laptop checklists (15 items)
      const laptopChecklists = [
        "Inspeção das condições físicas", "Teste de exibição da tela", "Verificação da funcionalidade do teclado", "Teste de responsividade do trackpad",
        "Funcionalidade das portas USB", "Teste da entrada de áudio", "Teste de alto-falantes e microfone", "Teste de conectividade Wi-Fi",
        "Verificação da funcionalidade Bluetooth", "Teste da porta de carregamento e adaptador", "Avaliação do desempenho da bateria", "Teste de funcionalidade da webcam",
        "Teste de saída HDMI/display", "Teste de boot e desempenho do sistema", "Verificação do sistema de ventilação e resfriamento"
      ];

      // Desktop checklists (15 items)
      const desktopChecklists = [
        "Inspeção das condições físicas", "Funcionalidade da fonte de alimentação", "Teste de saída de exibição do monitor", "Teste de teclado e mouse",
        "Verificação da funcionalidade das portas USB", "Teste de entrada/saída de áudio", "Teste de conectividade de rede", "Teste do drive de CD/DVD",
        "Verificação do desempenho do disco rígido", "Teste de funcionalidade da RAM", "Avaliação do desempenho da CPU", "Teste da placa de vídeo",
        "Verificação do sistema de ventilação e resfriamento", "Teste de acesso ao BIOS/UEFI", "Teste de estabilidade geral do sistema"
      ];

      // Create all checklists using batch insert for better performance
      const allChecklists = [
        ...phoneChecklists.map(name => ({ tenantId, deviceType: 'Phone', name, isActive: true })),
        ...laptopChecklists.map(name => ({ tenantId, deviceType: 'Laptop', name, isActive: true })),
        ...desktopChecklists.map(name => ({ tenantId, deviceType: 'Desktop', name, isActive: true }))
      ];

      console.log(`📝 Creating ${allChecklists.length} default checklists for tenant ${tenantId}`);
      
      // Insert all checklists in batches to avoid overwhelming the database
      await withRetry(async () => {
        await db.insert(checklists).values(allChecklists);
      });

      console.log(`✅ Successfully initialized ${allChecklists.length} default checklists for tenant ${tenantId}`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize default checklists for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateChecklistsToPortuguese(tenantId: string): Promise<void> {
    const englishToPortuguese: Record<string, string> = {
      // Phone checklists
      "Audio System Check": "Verificação do Sistema de Áudio",
      "Battery charging and capacity test": "Teste de carregamento e capacidade da bateria",
      "Biometric Security Test": "Teste de Segurança Biométrica",
      "Button Operation Test": "Teste de Operação dos Botões",
      "Camera Functionality": "Funcionalidade da Câmera",
      "Camera focus and image quality": "Foco da câmera e qualidade da imagem",
      "Cellular signal strength test": "Teste de força do sinal celular",
      "Charging port condition check": "Verificação da condição da porta de carregamento",
      "Connectivity Assessment": "Avaliação de Conectividade",
      "Fingerprint scanner functionality (if applicable)": "Funcionalidade do scanner de impressão digital (se aplicável)",
      "Home/navigation buttons functionality": "Funcionalidade dos botões home/navegação",
      "Liquid damage indicator inspection": "Inspeção do indicador de danos por líquidos",
      "Network Signal Quality": "Qualidade do Sinal de Rede",
      "Physical Condition Assessment": "Avaliação das Condições Físicas",
      "Physical damage to housing/frame": "Danos físicos na carcaça/estrutura",
      "Port and Connector Check": "Verificação de Portas e Conectores",
      "Power and Battery Status": "Status da Energia e Bateria",
      "Power button functionality test": "Teste de funcionalidade do botão de energia",
      "Screen Display Test": "Teste de Exibição da Tela",
      "Screen condition and crack assessment": "Avaliação da condição e rachaduras da tela",
      "Sensor Verification": "Verificação de Sensores",
      "SIM card slot condition": "Condição do slot do cartão SIM",
      "Software Operation": "Operação do Software",
      "Speaker and microphone quality test": "Teste de qualidade do alto-falante e microfone",
      "Storage and Memory Test": "Teste de Armazenamento e Memória",
      "Touch screen responsiveness check": "Verificação de responsividade da tela sensível ao toque",
      "Vibration Motor Check": "Verificação do Motor de Vibração",
      "Volume buttons operation test": "Teste de operação dos botões de volume",
      "Water Damage Inspection": "Inspeção de Danos por Água",
      "WiFi connectivity test": "Teste de conectividade WiFi",

      // Laptop checklists
      "Audio and Microphone Check": "Verificação de Áudio e Microfone",
      "Audio output quality test": "Teste de qualidade de saída de áudio",
      "Battery Health Assessment": "Avaliação da Saúde da Bateria",
      "Battery charging status and capacity": "Status de carregamento e capacidade da bateria",
      "Boot sequence and timing check": "Verificação da sequência e timing de boot",
      "CPU temperature monitoring": "Monitoramento de temperatura da CPU",
      "Display and Screen Quality": "Qualidade da Exibição e Tela",
      "External Display Output": "Saída de Exibição Externa",
      "Fan and Thermal Check": "Verificação de Ventilação e Térmica",
      "Hard Drive/SSD Status": "Status do Disco Rígido/SSD",
      "Hinge and Build Quality": "Qualidade da Dobradiça e Construção",
      "Hinge operation and stability check": "Verificação de operação e estabilidade da dobradiça",
      "Internal dust accumulation assessment": "Avaliação de acúmulo de poeira interna",
      "Internal fan operation test": "Teste de operação do ventilador interno",
      "Keyboard and Trackpad Test": "Teste de Teclado e Trackpad",
      "Keyboard key responsiveness test": "Teste de responsividade das teclas do teclado",
      "Memory (RAM) Test": "Teste de Memória (RAM)",
      "Operating System Boot": "Boot do Sistema Operacional",
      "Physical Port Inspection": "Inspeção de Portas Físicas",
      "Power Adapter and Charging": "Adaptador de Energia e Carregamento",
      "Power adapter functionality test": "Teste de funcionalidade do adaptador de energia",
      "RAM recognition and capacity test": "Teste de reconhecimento e capacidade da RAM",
      "Screen display quality and brightness": "Qualidade e brilho da exibição da tela",
      "Storage device health check": "Verificação de saúde do dispositivo de armazenamento",
      "System Performance": "Desempenho do Sistema",
      "Trackpad accuracy and gesture test": "Teste de precisão e gestos do trackpad",
      "USB and HDMI port functionality": "Funcionalidade das portas USB e HDMI",
      "Webcam and Camera Test": "Teste de Webcam e Câmera",
      "Wi-Fi and Bluetooth Test": "Teste de Wi-Fi e Bluetooth",
      "WiFi and Bluetooth connectivity": "Conectividade WiFi e Bluetooth",

      // Desktop checklists
      "All port functionality check": "Verificação de funcionalidade de todas as portas",
      "Audio Input/Output Jacks": "Entradas/Saídas de Áudio",
      "Audio system functionality": "Funcionalidade do sistema de áudio",
      "BIOS/UEFI Access": "Acesso ao BIOS/UEFI",
      "Cable and Connection Check": "Verificação de Cabos e Conexões",
      "Cable connection integrity": "Integridade da conexão dos cabos",
      "Case Fan Operation": "Operação do Ventilador da Carcaça",
      "Component dust accumulation check": "Verificação de acúmulo de poeira nos componentes",
      "CPU and Cooling System": "CPU e Sistema de Resfriamento",
      "Front and Rear USB Ports": "Portas USB Frontais e Traseiras",
      "Graphics Card Function": "Função da Placa de Vídeo",
      "Hard Drive/SSD Recognition": "Reconhecimento do Disco Rígido/SSD",
      "Internal component seating check": "Verificação do assentamento dos componentes internos",
      "Internal fan operation assessment": "Avaliação da operação do ventilador interno",
      "Keyboard and mouse responsiveness": "Responsividade do teclado e mouse",
      "Memory (RAM) Detection": "Detecção de Memória (RAM)",
      "Memory (RAM) recognition test": "Teste de reconhecimento da memória (RAM)",
      "Monitor Connection and Display": "Conexão e Exibição do Monitor",
      "Monitor display output test": "Teste de saída de exibição do monitor",
      "Motherboard POST Test": "Teste POST da Placa-mãe",
      "Network Interface Card": "Placa de Interface de Rede",
      "Network connectivity test": "Teste de conectividade de rede",
      "Operating System Boot Test": "Teste de Boot do Sistema Operacional",
      "Optical Drive Function": "Função da Unidade Óptica",
      "Optical drive operation test": "Teste de operação da unidade óptica",
      "Power Supply Unit (PSU) Test": "Teste da Fonte de Alimentação (PSU)",
      "Power supply unit functionality test": "Teste de funcionalidade da fonte de alimentação",
      "Storage device detection check": "Verificação de detecção do dispositivo de armazenamento",
      "System boot sequence verification": "Verificação da sequência de boot do sistema",
      "System temperature monitoring": "Monitoramento de temperatura do sistema"
    };

    try {
      const existingChecklists = await this.getChecklists(tenantId);
      let updatedCount = 0;

      for (const checklist of existingChecklists) {
        const portugueseName = englishToPortuguese[checklist.name];
        if (portugueseName) {
          await withRetry(async () => {
            await db
              .update(checklists)
              .set({ name: portugueseName, updatedAt: new Date() })
              .where(and(
                eq(checklists.id, checklist.id),
                eq(checklists.tenantId, tenantId)
              ));
          });
          updatedCount++;
        }
      }

      console.log(`✅ Successfully updated ${updatedCount} checklists to Portuguese for tenant ${tenantId}`);
    } catch (error) {
      console.error(`❌ Failed to update checklists to Portuguese for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async ensureChecklistsAreInPortuguese(tenantId: string): Promise<void> {
    try {
      // Quick check to see if any English names exist
      const checklistData = await withRetry(async () => {
        return await db
          .select({ id: checklists.id, name: checklists.name })
          .from(checklists)
          .where(eq(checklists.tenantId, tenantId))
          .limit(5); // Just check first few to save performance
      });

      const hasEnglishNames = checklistData.some((item: { id: string; name: string }) => 
        item.name.includes('Audio System Check') || 
        item.name.includes('Button Operation Test') ||
        item.name.includes('Physical Condition Assessment') ||
        item.name.includes('Power Supply Unit') ||
        item.name.includes('Test') ||
        item.name.includes('Check') ||
        item.name.includes('Assessment')
      );

      if (hasEnglishNames) {
        console.log(`🔄 Converting English checklists to Portuguese for tenant ${tenantId}`);
        await this.updateChecklistsToPortuguese(tenantId);
      }
    } catch (error) {
      console.error(`❌ Failed to ensure checklists are in Portuguese for tenant ${tenantId}:`, error);
      // Don't throw error to avoid breaking checklist fetching
    }
  }

  // Checklists operations implementation
  async getChecklists(tenantId: string): Promise<Checklist[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(checklists)
        .where(eq(checklists.tenantId, tenantId))
        .orderBy(asc(checklists.deviceType), asc(checklists.name));
    });
  }

  async getChecklistsByDeviceType(tenantId: string, deviceType: string): Promise<Checklist[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(checklists)
        .where(and(
          eq(checklists.tenantId, tenantId),
          eq(checklists.deviceType, deviceType),
          eq(checklists.isActive, true)
        ))
        .orderBy(asc(checklists.name));
    });
  }

  async createChecklist(checklist: InsertChecklist): Promise<Checklist> {
    return withRetry(async () => {
      const [newChecklist] = await db
        .insert(checklists)
        .values(checklist)
        .returning();
      return newChecklist;
    });
  }

  async updateChecklist(id: string, tenantId: string, checklist: Partial<InsertChecklist>): Promise<Checklist | undefined> {
    return withRetry(async () => {
      const [updatedChecklist] = await db
        .update(checklists)
        .set({ ...checklist, updatedAt: new Date() })
        .where(and(
          eq(checklists.id, id),
          eq(checklists.tenantId, tenantId)
        ))
        .returning();
      return updatedChecklist;
    });
  }

  async deleteChecklist(id: string, tenantId: string): Promise<boolean> {
    return withRetry(async () => {
      const result = await db
        .delete(checklists)
        .where(and(
          eq(checklists.id, id),
          eq(checklists.tenantId, tenantId)
        ));
      return (result.rowCount ?? 0) > 0;
    });
  }

  // Completion Analytics Operations

  private async createCompletionAnalyticsRecord(
    ticket: Ticket, 
    actualHours: number, 
    finalActualCost: number
  ): Promise<void> {
    try {
      // Calculate variance data
      const estimatedHours = ticket.technicianEstimatedHours || 0;
      const estimatedCost = parseFloat(ticket.costEstimation || '0');
      
      const hoursVariance = actualHours - estimatedHours;
      const hoursVariancePercentage = estimatedHours > 0 ? ((hoursVariance / estimatedHours) * 100) : 0;
      
      const costVariance = finalActualCost - estimatedCost;
      const costVariancePercentage = estimatedCost > 0 ? ((costVariance / estimatedCost) * 100) : 0;
      
      // Calculate accuracy score (0-100, where 100 is perfect estimate)
      const timeAccuracy = estimatedHours > 0 ? Math.max(0, 100 - Math.abs(hoursVariancePercentage)) : 50;
      const costAccuracy = estimatedCost > 0 ? Math.max(0, 100 - Math.abs(costVariancePercentage)) : 50;
      const accuracyScore = (timeAccuracy + costAccuracy) / 2;
      
      // Determine service complexity based on services selected
      let serviceComplexity = 'medium';
      const servicesCount = Array.isArray(ticket.selectedServices) ? ticket.selectedServices.length : 0;
      if (servicesCount <= 1) serviceComplexity = 'low';
      else if (servicesCount >= 4) serviceComplexity = 'high';
      
      const analyticsData: InsertCompletionAnalytics = {
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        deviceType: ticket.deviceType || 'Unknown',
        estimatedHours,
        actualHours,
        hoursVariance,
        hoursVariancePercentage: hoursVariancePercentage.toString(),
        estimatedCost: estimatedCost.toString(),
        finalActualCost: finalActualCost.toString(),
        costVariance: costVariance.toString(),
        costVariancePercentage: costVariancePercentage.toString(),
        accuracyScore: accuracyScore.toString(),
        completedBy: ticket.completedBy!,
        selectedServices: ticket.selectedServices || [],
        serviceComplexity,
        completedAt: ticket.completedAt!,
      };
      
      await this.createCompletionAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to create completion analytics record:', error);
      // Don't throw error to avoid breaking ticket finalization
    }
  }

  async createCompletionAnalytics(analytics: InsertCompletionAnalytics): Promise<CompletionAnalytics> {
    return withRetry(async () => {
      const [result] = await db
        .insert(completionAnalytics)
        .values(analytics)
        .returning();
      return result;
    });
  }

  async getCompletionAnalytics(tenantId: string, limit?: number): Promise<CompletionAnalytics[]> {
    return withRetry(async () => {
      let query = db
        .select()
        .from(completionAnalytics)
        .where(eq(completionAnalytics.tenantId, tenantId))
        .orderBy(desc(completionAnalytics.completedAt));
      
      if (limit) {
        query = query.limit(limit);
      }
      
      return await query;
    });
  }

  async getAnalyticsByDateRange(tenantId: string, startDate: Date, endDate: Date): Promise<CompletionAnalytics[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(completionAnalytics)
        .where(
          and(
            eq(completionAnalytics.tenantId, tenantId),
            sql`${completionAnalytics.completedAt} >= ${startDate}`,
            sql`${completionAnalytics.completedAt} <= ${endDate}`
          )
        )
        .orderBy(desc(completionAnalytics.completedAt));
    });
  }

  async getAnalyticsByDeviceType(tenantId: string, deviceType: string): Promise<CompletionAnalytics[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(completionAnalytics)
        .where(
          and(
            eq(completionAnalytics.tenantId, tenantId),
            eq(completionAnalytics.deviceType, deviceType)
          )
        )
        .orderBy(desc(completionAnalytics.completedAt));
    });
  }

  async getAnalyticsByTechnician(tenantId: string, completedBy: string): Promise<CompletionAnalytics[]> {
    return withRetry(async () => {
      return await db
        .select()
        .from(completionAnalytics)
        .where(
          and(
            eq(completionAnalytics.tenantId, tenantId),
            eq(completionAnalytics.completedBy, completedBy)
          )
        )
        .orderBy(desc(completionAnalytics.completedAt));
    });
  }
}

export const storage = new DatabaseStorage();
