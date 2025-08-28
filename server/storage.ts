import {
  users,
  tenants,
  clients,
  tickets,
  inventoryItems,
  transactions,
  supportTickets,
  localizations,
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
  type Localization,
  type InsertLocalization,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenantLanguage(id: string, language: string): Promise<Tenant | undefined>;
  
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
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

  async updateTenantLanguage(id: string, language: string): Promise<Tenant | undefined> {
    const [tenant] = await db
      .update(tenants)
      .set({ preferredLanguage: language, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
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
    return db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.tenantId, tenantId),
          or(
            ilike(clients.firstName, `%${query}%`),
            ilike(clients.lastName, `%${query}%`),
            ilike(clients.email, `%${query}%`),
            ilike(clients.cpf, `%${query}%`)
          )
        )
      )
      .orderBy(desc(clients.updatedAt))
      .limit(10);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
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
        deviceType: tickets.deviceType,
        deviceModel: tickets.deviceModel,
        issueDescription: tickets.issueDescription,
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
          name: tenants.name,
          alias: tenants.alias,
          shopImageUrl: tenants.shopImageUrl,
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
}

export const storage = new DatabaseStorage();
