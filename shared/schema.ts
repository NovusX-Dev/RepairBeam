import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  tenantId: varchar("tenant_id").notNull(),
  role: varchar("role").notNull().default('user'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tenants table for multi-tenancy
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  alias: varchar("alias"), // Shop display name/alias
  shopImageUrl: varchar("shop_image_url"), // Shop logo/image URL
  domain: varchar("domain").unique(),
  preferredLanguage: varchar("preferred_language").default('en'), // User's preferred language
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  cpf: varchar("cpf"),
  email: varchar("email"),
  phone: varchar("phone"),
  streetAddress: varchar("street_address"),
  streetNumber: varchar("street_number"),
  apartment: varchar("apartment"),
  birthday: varchar("birthday"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Kanban ticket statuses enum
export const ticketStatusEnum = [
  'backlog',
  'waiting_diagnostics',
  'waiting_client_approval', 
  'approved',
  'servicing',
  'quality_check',
  'final_customer_check',
  'finalized'
] as const;

export const ticketPriorityEnum = [
  'low',
  'medium', 
  'high',
  'urgent'
] as const;

// Tickets table for Kanban board
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clientId: varchar("client_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  status: varchar("status").notNull().default('backlog'),
  priority: varchar("priority").notNull().default('medium'),
  assignedTo: varchar("assigned_to"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  deviceType: varchar("device_type"),
  deviceModel: varchar("device_model"),
  issueDescription: text("issue_description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inventory items table
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  sku: varchar("sku"),
  category: varchar("category"),
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  supplier: varchar("supplier"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales transactions for POS
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clientId: varchar("client_id"),
  ticketId: varchar("ticket_id"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default('0'),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default('0'),
  paymentMethod: varchar("payment_method").notNull(),
  status: varchar("status").notNull().default('completed'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support tickets
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  clientId: varchar("client_id").notNull(),
  subject: varchar("subject").notNull(),
  description: text("description").notNull(),
  status: varchar("status").notNull().default('open'),
  priority: varchar("priority").notNull().default('medium'),
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Localization table
export const localizations = pgTable("localizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull(),
  language: varchar("language").notNull(), // e.g., 'en', 'es', 'fr', etc.
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_localization_key_language").on(table.key, table.language),
]);

// Auto-generated lists table for AI-powered data (brands, models, etc.)
export const autoGenLists = pgTable("auto_gen_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listType: varchar("list_type").notNull(), // e.g., 'AutoGen-List-Brands-Phone', 'AutoGen-List-Models-Phone-Apple'
  category: varchar("category").notNull(), // e.g., 'Phone', 'Laptop', 'Desktop'
  brand: varchar("brand"), // e.g., 'Apple', 'Samsung' - null for brand lists, specific for model lists
  items: text("items").array().notNull(), // Array of brand names or model names
  excludedBrands: text("excluded_brands").array().default([]), // Brands with no models that should be excluded
  lastGenerated: timestamp("last_generated").defaultNow(),
  nextUpdate: timestamp("next_update").notNull(), // When to regenerate
  refreshInterval: varchar("refresh_interval").notNull().default('quarterly'), // weekly, biweekly, monthly, quarterly
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_auto_gen_list_type").on(table.listType),
  index("idx_auto_gen_category").on(table.category),
  index("idx_auto_gen_brand").on(table.brand),
]);

// Relations
export const tenantRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  tickets: many(tickets),
  inventoryItems: many(inventoryItems),
  transactions: many(transactions),
  supportTickets: many(supportTickets),
}));

export const userRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const clientRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clients.tenantId],
    references: [tenants.id],
  }),
  tickets: many(tickets),
  transactions: many(transactions),
  supportTickets: many(supportTickets),
}));

export const ticketRelations = relations(tickets, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tickets.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [tickets.clientId],
    references: [clients.id],
  }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;
export type Localization = typeof localizations.$inferSelect;
export type InsertLocalization = typeof localizations.$inferInsert;
export type AutoGenList = typeof autoGenLists.$inferSelect;
export type InsertAutoGenList = typeof autoGenLists.$inferInsert;

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLocalizationSchema = createInsertSchema(localizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAutoGenListSchema = createInsertSchema(autoGenLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTicketType = z.infer<typeof insertTicketSchema>;
export type InsertLocalizationType = z.infer<typeof insertLocalizationSchema>;
export type InsertAutoGenListType = z.infer<typeof insertAutoGenListSchema>;
export type TicketStatus = (typeof ticketStatusEnum)[number];
export type TicketPriority = (typeof ticketPriorityEnum)[number];
