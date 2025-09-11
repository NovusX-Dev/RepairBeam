import {
  users,
  tenants,
  clients,
  tickets,
  inventoryItems,
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
  type User,
  type UpsertUser,
  type Tenant,
  type InsertTenant,
  type Client,
  type InsertClient,
  type Ticket,
  type InsertTicket,
  type InventoryItem,
  type InsertInventoryItem,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, ilike, sql, asc } from "drizzle-orm";

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
  getTicket(id: string, tenantId: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicketStatus(ticketId: string, status: string, tenantId: string): Promise<Ticket | undefined>;
  updateTicketPriority(ticketId: string, priority: string, tenantId: string): Promise<Ticket | undefined>;
  checkTicketIdExists(ticketId: string, tenantId: string): Promise<boolean>;
  
  // Inventory operations
  getInventoryItems(tenantId: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string, tenantId: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  
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
        warrantyType: tickets.warrantyType,
        costEstimation: tickets.costEstimation,
        costExplanation: tickets.costExplanation,
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

  async updateTicketStatus(ticketId: string, status: string, tenantId: string): Promise<Ticket | undefined> {
    const [updatedTicket] = await db
      .update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
      .returning();
    return updatedTicket;
  }

  async updateTicketPriority(ticketId: string, priority: string, tenantId: string): Promise<Ticket | undefined> {
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

  // Inventory operations
  async getInventoryItems(tenantId: string): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
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
      console.log(`🔍 Querying repair services for tenantId: ${tenantId}, deviceType: ${deviceType}`);
      
      const result = await db
        .select()
        .from(repairServices)
        .where(and(
          eq(repairServices.tenantId, tenantId),
          eq(repairServices.deviceType, deviceType)
          // Temporarily removing isActive filter to test
          // eq(repairServices.isActive, true)
        ))
        .orderBy(asc(repairServices.name));
      
      console.log(`🔍 Found ${result.length} repair services for device type: ${deviceType}`);
      if (result.length === 0) {
        // Debug: Let's see all services for this tenant
        const allServices = await db
          .select()
          .from(repairServices)
          .where(eq(repairServices.tenantId, tenantId));
        console.log(`🔍 All services for tenant:`, allServices.map(s => ({ id: s.id, name: s.name, deviceType: s.deviceType, isActive: s.isActive })));
      }
      
      return result;
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
}

export const storage = new DatabaseStorage();
