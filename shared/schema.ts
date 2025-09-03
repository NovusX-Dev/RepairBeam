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

// Tenants table for multi-tenancy (simplified - configs moved to store_settings)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: varchar("domain").unique(),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// General store settings table (now the single source of truth for tenant configs)
export const storeSettings = pgTable("store_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  shopName: varchar("shop_name"),
  shopAlias: varchar("shop_alias"), // Short display name for the shop
  shopDescription: text("shop_description"),
  shopLogoUrl: varchar("shop_logo_url"),
  contactPhone: varchar("contact_phone"),
  address: text("address"),
  businessHours: jsonb("business_hours").default('{"monday":{"open":"09:00","close":"18:00","closed":false},"tuesday":{"open":"09:00","close":"18:00","closed":false},"wednesday":{"open":"09:00","close":"18:00","closed":false},"thursday":{"open":"09:00","close":"18:00","closed":false},"friday":{"open":"09:00","close":"18:00","closed":false},"saturday":{"open":"10:00","close":"16:00","closed":false},"sunday":{"open":"","close":"","closed":true}}'),
  preferredLanguage: varchar("preferred_language").default('en'), // User's preferred language
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Warranty tiers configuration table
export const warrantyTiers = pgTable("warranty_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  deviceType: varchar("device_type").notNull(),
  tierType: varchar("tier_type").notNull(), // 'standard' or 'extended'
  durationMonths: integer("duration_months").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default('0.00'),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
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
  'critical',
  'vip'
] as const;

export const warrantyTypeEnum = [
  'standard',  // 3 months, free
  'extended'   // 6 months, paid
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
  deviceColor: varchar("device_color"),
  deviceMemory: varchar("device_memory"),
  deviceStorageCapacity: varchar("device_storage_capacity"),
  issueDescription: text("issue_description"),
  // Service Timeline & Coverage fields
  clientDeadline: timestamp("client_deadline"),
  technicianEstimatedHours: integer("technician_estimated_hours"),
  warrantyType: varchar("warranty_type").default('standard'),
  costEstimation: decimal("cost_estimation", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  costExplanation: text("cost_explanation"),
  // Service Checklist - JSON storing component conditions when device was received
  serviceChecklist: jsonb("service_checklist"),
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

// Ticket notes
export const ticketNotes = pgTable("ticket_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  ticketId: varchar("ticket_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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

// Device checklist templates - defines what components to check for each device type
export const deviceChecklistTemplates = pgTable("device_checklist_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceType: varchar("device_type").notNull(), // e.g., 'Phone', 'Laptop', 'Desktop'
  components: text("components").array().notNull(), // Array of component names to check
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_device_checklist_type").on(table.deviceType),
]);

// Device colors table - stores color information for specific devices
export const deviceColors = pgTable("device_colors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceType: varchar("device_type").notNull(), // 'Phone', 'Tablet', 'Laptop'
  brand: varchar("brand").notNull(), // 'Apple', 'Samsung', etc.
  model: varchar("model").notNull(), // 'iPhone 15 Pro', 'Galaxy S24', etc.
  colors: text("colors").array().notNull(), // Array of available colors
  source: varchar("source").notNull().default('manual'), // 'gsmarena', 'manual', 'fonoapi', etc.
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_device_colors_lookup").on(table.deviceType, table.brand, table.model),
  index("idx_device_colors_brand").on(table.brand),
]);


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
export type TicketNote = typeof ticketNotes.$inferSelect;
export type InsertTicketNote = typeof ticketNotes.$inferInsert;
export type Localization = typeof localizations.$inferSelect;
export type InsertLocalization = typeof localizations.$inferInsert;
export type AutoGenList = typeof autoGenLists.$inferSelect;
export type InsertAutoGenList = typeof autoGenLists.$inferInsert;
export type DeviceColor = typeof deviceColors.$inferSelect;
export type InsertDeviceColor = typeof deviceColors.$inferInsert;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type InsertStoreSettings = typeof storeSettings.$inferInsert;
export type WarrantyTier = typeof warrantyTiers.$inferSelect;
export type InsertWarrantyTier = typeof warrantyTiers.$inferInsert;

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

export const insertDeviceColorSchema = createInsertSchema(deviceColors).omit({
  id: true,
  createdAt: true,
});

export const insertDeviceChecklistTemplateSchema = createInsertSchema(deviceChecklistTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarrantyTierSchema = createInsertSchema(warrantyTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User progress tracking for gamification
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  totalActions: integer("total_actions").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastActiveDate: timestamp("last_active_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Achievement definitions
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // e.g., 'first_client', 'ticket_master', etc.
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon").notNull(), // Icon name or emoji
  category: varchar("category").notNull(), // e.g., 'clients', 'tickets', 'sales'
  requiredValue: integer("required_value").notNull(), // Number needed to unlock
  experienceReward: integer("experience_reward").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false), // Secret achievements
  createdAt: timestamp("created_at").defaultNow(),
});

// User achievement unlocks
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  achievementId: varchar("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
}, (table) => [
  index("idx_user_achievements_user").on(table.userId),
  index("idx_user_achievements_tenant").on(table.tenantId),
]);

// Issue assessment questions - device-specific diagnostic questions
export const issueQuestions = pgTable("issue_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceType: varchar("device_type").notNull(), // 'Phone', 'Laptop', 'Desktop'
  questionOrder: integer("question_order").notNull(), // 1-10 for ordering
  questionKey: varchar("question_key").notNull(), // for localization
  questionType: varchar("question_type").notNull().default('boolean'), // 'boolean', 'text', 'single_choice', 'multiple_choice'
  isConditional: boolean("is_conditional").notNull().default(false), // shows only if device turns on
  isRequired: boolean("is_required").notNull().default(true),
  options: text("options").array(), // for choice questions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_issue_questions_device_type").on(table.deviceType),
  index("idx_issue_questions_order").on(table.questionOrder),
]);

// Issue assessment responses - stores client answers for tickets
export const issueResponses = pgTable("issue_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull(),
  questionId: varchar("question_id").notNull(),
  response: text("response").notNull(), // JSON string for complex responses
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_issue_responses_ticket").on(table.ticketId),
  index("idx_issue_responses_question").on(table.questionId),
]);

// Activity tracking for gamification
export const userActivities = pgTable("user_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  activityType: varchar("activity_type").notNull(), // e.g., 'client_created', 'ticket_completed'
  entityType: varchar("entity_type"), // e.g., 'client', 'ticket', 'transaction'
  entityId: varchar("entity_id"), // ID of the entity involved
  experienceGained: integer("experience_gained").notNull().default(0),
  metadata: jsonb("metadata").default({}), // Additional activity data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_activities_user").on(table.userId),
  index("idx_user_activities_type").on(table.activityType),
  index("idx_user_activities_date").on(table.createdAt),
]);

// Schema exports for gamification
export const userProgressInsertSchema = createInsertSchema(userProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const achievementInsertSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

export const userAchievementInsertSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

export const userActivityInsertSchema = createInsertSchema(userActivities).omit({
  id: true,
  createdAt: true,
});

export const issueQuestionInsertSchema = createInsertSchema(issueQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const issueResponseInsertSchema = createInsertSchema(issueResponses).omit({
  id: true,
  createdAt: true,
});

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof userProgressInsertSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof achievementInsertSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof userAchievementInsertSchema>;
export type UserActivity = typeof userActivities.$inferSelect;
export type InsertUserActivity = z.infer<typeof userActivityInsertSchema>;
export type IssueQuestion = typeof issueQuestions.$inferSelect;
export type InsertIssueQuestion = z.infer<typeof issueQuestionInsertSchema>;
export type IssueResponse = typeof issueResponses.$inferSelect;
export type InsertIssueResponse = z.infer<typeof issueResponseInsertSchema>;

export type InsertTicketType = z.infer<typeof insertTicketSchema>;
export type InsertLocalizationType = z.infer<typeof insertLocalizationSchema>;
export type InsertAutoGenListType = z.infer<typeof insertAutoGenListSchema>;
export type InsertDeviceColorType = z.infer<typeof insertDeviceColorSchema>;
export type DeviceChecklistTemplate = typeof deviceChecklistTemplates.$inferSelect;
export type InsertDeviceChecklistTemplate = z.infer<typeof insertDeviceChecklistTemplateSchema>;
export type TicketStatus = (typeof ticketStatusEnum)[number];
export type TicketPriority = (typeof ticketPriorityEnum)[number];
export type WarrantyType = (typeof warrantyTypeEnum)[number];

// Relations - moved to end after all tables are defined
export const tenantRelations = relations(tenants, ({ many, one }) => ({
  users: many(users),
  clients: many(clients),
  tickets: many(tickets),
  inventoryItems: many(inventoryItems),
  transactions: many(transactions),
  supportTickets: many(supportTickets),
  storeSettings: one(storeSettings),
  warrantyTiers: many(warrantyTiers),
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
  issueResponses: many(issueResponses),
}));

export const ticketRelations = relations(tickets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tickets.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [tickets.clientId],
    references: [clients.id],
  }),
  issueResponses: many(issueResponses),
}));

export const issueQuestionRelations = relations(issueQuestions, ({ many }) => ({
  responses: many(issueResponses),
}));

export const issueResponseRelations = relations(issueResponses, ({ one }) => ({
  ticket: one(tickets, {
    fields: [issueResponses.ticketId],
    references: [tickets.id],
  }),
  question: one(issueQuestions, {
    fields: [issueResponses.questionId],
    references: [issueQuestions.id],
  }),
}));

export const storeSettingsRelations = relations(storeSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [storeSettings.tenantId],
    references: [tenants.id],
  }),
}));

export const warrantyTierRelations = relations(warrantyTiers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [warrantyTiers.tenantId],
    references: [tenants.id],
  }),
}));
