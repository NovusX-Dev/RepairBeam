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
  check,
  unique,
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
  role: varchar("role").notNull().default('user'), // Basic role: 'user', 'admin', 'master'
  status: varchar("status").notNull().default('active'), // 'active', 'suspended', 'pending'
  passwordHash: varchar("password_hash"), // For email/password auth (null for OIDC users)
  mustChangePassword: boolean("must_change_password").default(false),
  phone: varchar("phone"),
  telegram: varchar("telegram"),
  lastLoginAt: timestamp("last_login_at"),
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

// Groups table for RBAC - permission groups scoped to tenants
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull().default('[]'), // Array of permission strings
  isDefault: boolean("is_default").default(false), // Default group for new users
  isSystemGroup: boolean("is_system_group").default(false), // Cannot be deleted (e.g., Admin group)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique('unique_group_name_per_tenant').on(table.tenantId, table.name),
  index('idx_groups_tenant').on(table.tenantId),
]);

// User Groups junction table - many-to-many relationship
export const userGroups = pgTable("user_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique('unique_user_group').on(table.userId, table.groupId),
  index('idx_user_groups_user').on(table.userId),
  index('idx_user_groups_group').on(table.groupId),
  index('idx_user_groups_tenant').on(table.tenantId),
]);

// User Invitations table for password-based user onboarding
export const userInvitations = pgTable("user_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar("email").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  telegram: varchar("telegram"),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id),
  groupIds: jsonb("group_ids").notNull().default('[]'), // Array of group IDs to assign on acceptance
  token: varchar("token").notNull().unique(), // Unique invitation token (kept for backward compatibility)
  temporaryPassword: varchar("temporary_password"), // Plain-text temporary password shown to admins
  expiresAt: timestamp("expires_at").notNull(),
  status: varchar("status").notNull().default('pending'), // 'pending', 'accepted', 'expired'
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index('idx_user_invitations_token').on(table.token),
  index('idx_user_invitations_tenant').on(table.tenantId),
  index('idx_user_invitations_email').on(table.email),
]);

// Audit Logs table for tracking permission-sensitive actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  action: varchar("action").notNull(), // 'create', 'update', 'delete', 'login', etc.
  resource: varchar("resource").notNull(), // 'user', 'group', 'ticket', 'inventory', etc.
  resourceId: varchar("resource_id"),
  details: jsonb("details"), // Additional context about the action
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index('idx_audit_logs_tenant').on(table.tenantId),
  index('idx_audit_logs_user').on(table.userId),
  index('idx_audit_logs_resource').on(table.resource),
  index('idx_audit_logs_created_at').on(table.createdAt),
]);

// General store settings table (now the single source of truth for tenant configs)
export const storeSettings = pgTable("store_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  shopName: varchar("shop_name"),
  shopAlias: varchar("shop_alias"), // Short display name for the shop
  shopDescription: text("shop_description"),
  shopLogoUrl: varchar("shop_logo_url"),
  address: text("address"),
  businessHours: jsonb("business_hours").default('{"monday":{"open":"09:00","close":"18:00","closed":false},"tuesday":{"open":"09:00","close":"18:00","closed":false},"wednesday":{"open":"09:00","close":"18:00","closed":false},"thursday":{"open":"09:00","close":"18:00","closed":false},"friday":{"open":"09:00","close":"18:00","closed":false},"saturday":{"open":"10:00","close":"16:00","closed":false},"sunday":{"open":"","close":"","closed":true}}'),
  preferredLanguage: varchar("preferred_language").default('en'), // User's preferred language
  // Invoice settings
  invoicePrefix: varchar("invoice_prefix").default('INV'), // Invoice number prefix (e.g., "INV", "FAT")
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1), // Auto-incrementing invoice number
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('0'), // Tax rate as percentage (e.g., 8.5 for 8.5%)
  invoiceFooterText: text("invoice_footer_text"), // Custom footer text for invoices
  warrantyTermsText: text("warranty_terms_text"), // Default warranty terms for invoices
  defaultCountryCode: varchar("default_country_code").default('+55'), // Default country code for phone numbers (e.g., +55 for Brazil)
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

// Repair services table
export const repairServices = pgTable("repair_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  deviceType: varchar("device_type").notNull(), // 'Phone', 'Laptop', 'Desktop'
  name: varchar("name").notNull(),
  description: text("description"),
  estimatedLaborCost: decimal("estimated_labor_cost", { precision: 10, scale: 2 }).notNull().default('0.00'),
  estimatedCompletionTimeHours: integer("estimated_completion_time_hours").notNull().default(0),
  estimatedCompletionTimeMinutes: integer("estimated_completion_time_minutes").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Possible defects table
export const possibleDefects = pgTable("possible_defects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  deviceType: varchar("device_type").notNull(), // 'Phone', 'Laptop', 'Desktop'
  name: varchar("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Checklists table
export const checklists = pgTable("checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  deviceType: varchar("device_type").notNull(), // 'Phone', 'Laptop', 'Desktop'
  name: varchar("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client status enum
export const clientStatusEnum = ['active', 'inactive', 'vip'] as const;
export type ClientStatus = typeof clientStatusEnum[number];

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
  status: varchar("status").default('active'),
  preferredLanguage: varchar("preferred_language").default('en'),
  tags: jsonb("tags").$type<string[]>().default([]),
  marketingOptIn: boolean("marketing_opt_in").default(false),
  lastVisitAt: timestamp("last_visit_at"),
  totalSpendCents: integer("total_spend_cents").default(0),
  ticketCount: integer("ticket_count").default(0),
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

// Status transition validation map
// Each status maps to an array of statuses it can transition to
export const statusTransitionMap: Record<TicketStatus, TicketStatus[]> = {
  'backlog': ['waiting_diagnostics', 'waiting_client_approval'],
  'waiting_diagnostics': ['waiting_client_approval', 'backlog'],
  'waiting_client_approval': ['approved', 'waiting_diagnostics', 'backlog'],
  'approved': ['servicing', 'waiting_client_approval', 'waiting_diagnostics', 'backlog'],
  'servicing': ['quality_check', 'approved', 'waiting_client_approval', 'waiting_diagnostics'],
  'quality_check': ['final_customer_check', 'servicing', 'approved', 'waiting_client_approval'],
  'final_customer_check': ['finalized', 'quality_check', 'servicing', 'approved'],
  'finalized': []
};

// Helper function to validate status transitions
export function isValidStatusTransition(currentStatus: TicketStatus, newStatus: TicketStatus): boolean {
  if (currentStatus === newStatus) {
    return true; // Allow staying in the same status
  }
  return statusTransitionMap[currentStatus].includes(newStatus);
}

// Helper function to get allowed next statuses
export function getAllowedNextStatuses(currentStatus: TicketStatus): TicketStatus[] {
  return statusTransitionMap[currentStatus];
}

// Helper function to get the standard next status (forward progression)
export function getStandardNextStatus(currentStatus: TicketStatus): TicketStatus | null {
  const currentIndex = ticketStatusEnum.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === ticketStatusEnum.length - 1) {
    return null; // Invalid status or already at final status
  }
  return ticketStatusEnum[currentIndex + 1];
}

// Helper function to check if a transition is forward (progress) or backward (regression)
export function isForwardTransition(currentStatus: TicketStatus, newStatus: TicketStatus): boolean {
  const currentIndex = ticketStatusEnum.indexOf(currentStatus);
  const newIndex = ticketStatusEnum.indexOf(newStatus);
  return newIndex > currentIndex;
}

// Helper function to categorize allowed transitions into forward and backward
export function getCategorizedTransitions(currentStatus: TicketStatus): {
  forward: TicketStatus[];
  backward: TicketStatus[];
} {
  const allowed = statusTransitionMap[currentStatus];
  const currentIndex = ticketStatusEnum.indexOf(currentStatus);
  
  const forward: TicketStatus[] = [];
  const backward: TicketStatus[] = [];
  
  for (const status of allowed) {
    const statusIndex = ticketStatusEnum.indexOf(status);
    if (statusIndex > currentIndex) {
      forward.push(status);
    } else {
      backward.push(status);
    }
  }
  
  return { forward, backward };
}

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
  deviceBrand: varchar("device_brand"),
  deviceModel: varchar("device_model"),
  deviceColor: varchar("device_color"),
  deviceMemory: varchar("device_memory"),
  deviceStorageCapacity: varchar("device_storage_capacity"),
  issueDescription: text("issue_description"),
  // Service Timeline & Coverage fields
  clientDeadline: timestamp("client_deadline"),
  technicianEstimatedHours: integer("technician_estimated_hours"),
  selectedServices: jsonb("selected_services").default('[]'), // Array of selected repair service IDs
  selectedItems: jsonb("selected_items").default('[]'), // Array of service items: {inventoryItemId, quantity, unitPrice}
  warrantyType: varchar("warranty_type").default('standard'),
  costEstimation: decimal("cost_estimation", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  costExplanation: text("cost_explanation"),
  // Service Checklist - JSON storing component conditions when device was received
  serviceChecklist: jsonb("service_checklist"),
  // Completion tracking fields
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"), // User ID who finalized the ticket
  finalActualCost: decimal("final_actual_cost", { precision: 10, scale: 2 }), // Locked final cost
  completionNotes: text("completion_notes"), // Notes about completion
  actualHours: integer("actual_hours"), // Actual time spent in hours
  // Signature tracking fields
  dropoffSignatureId: varchar("dropoff_signature_id"), // Signature request ID for drop-off
  pickupSignatureId: varchar("pickup_signature_id"), // Signature request ID for pickup
  // Archive field - hides finalized tickets from Kanban without deleting data
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Authorization requests table for WhatsApp client authorization
export const authorizationRequests = pgTable("authorization_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  ticketId: varchar("ticket_id").notNull(),
  clientPhone: varchar("client_phone").notNull(),
  status: varchar("status").notNull().default('pending'), // 'pending', 'authorized', 'rejected', 'expired'
  whatsappMessageId: varchar("whatsapp_message_id"),
  ticketSummaryFormat: varchar("ticket_summary_format").notNull().default('message'), // 'message' or 'pdf'
  sentAt: timestamp("sent_at"),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Signature request status enum
export const signatureRequestStatusEnum = [
  'pending',      // Created but not yet sent
  'sent',         // SMS sent successfully
  'signed',       // Client has signed
  'expired',      // Link expired without signature
  'failed'        // SMS send failed
] as const;

// Signature request type enum
export const signatureRequestTypeEnum = [
  'dropoff',      // Signature when creating ticket (client drops off device)
  'pickup'        // Signature when finalizing (client picks up device)
] as const;

// Signature requests table for SMS-based client signatures
export const signatureRequests = pgTable("signature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  ticketId: varchar("ticket_id"), // Null for dropoff until ticket is created
  clientId: varchar("client_id").notNull(),
  type: varchar("type").notNull(), // 'dropoff' or 'pickup'
  status: varchar("status").notNull().default('pending'), // 'pending', 'sent', 'signed', 'expired', 'failed'
  token: varchar("token").notNull().unique(), // Unique token for signing URL
  smsMessageSid: varchar("sms_message_sid"), // Twilio message SID for tracking
  clientPhone: varchar("client_phone").notNull(),
  signaturePng: text("signature_png"), // Base64 encoded signature image
  signerDeviceMeta: jsonb("signer_device_meta"), // Browser/device info for audit
  expiresAt: timestamp("expires_at").notNull(),
  sentAt: timestamp("sent_at"),
  signedAt: timestamp("signed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index('idx_signature_requests_token').on(table.token),
  index('idx_signature_requests_ticket').on(table.ticketId),
  index('idx_signature_requests_tenant').on(table.tenantId),
]);

// Signature audit event types enum
export const signatureAuditEventTypeEnum = [
  'sms_sent',           // SMS with signing link sent successfully
  'sms_failed',         // SMS send failed
  'sms_resent',         // SMS resent after initial failure or expiry
  'link_opened',        // Client opened the signing link
  'signature_started',  // Client started drawing signature
  'signature_completed',// Client submitted signature successfully
  'signature_expired',  // Signature request expired without completion
  'signature_cancelled' // Signature request was cancelled
] as const;

// Signature audit events table for tracking signature workflow
export const signatureAuditEvents = pgTable("signature_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestId: varchar("signature_request_id").notNull(),
  tenantId: varchar("tenant_id").notNull(),
  eventType: varchar("event_type").notNull(), // From signatureAuditEventTypeEnum
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  deviceMeta: jsonb("device_meta"), // Additional device info (screen size, platform, etc.)
  metadata: jsonb("metadata"), // Additional event-specific data (error messages, etc.)
  occurredAt: timestamp("occurred_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index('idx_signature_audit_events_request').on(table.signatureRequestId),
  index('idx_signature_audit_events_tenant').on(table.tenantId),
  index('idx_signature_audit_events_occurred').on(table.occurredAt),
]);

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  address: text("address"),
  phone: varchar("phone"),
  cellphone: varchar("cellphone"),
  email: varchar("email"),
  cnpj: varchar("cnpj"), // Brazilian tax ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inventory categories table
export const inventoryCategories = pgTable("inventory_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  deviceType: varchar("device_type"), // 'Phone', 'Laptop', 'Desktop', or null for 'Other'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inventory items table
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  supplierId: varchar("supplier_id"), // Foreign key to suppliers table - items from different suppliers are tracked separately
  name: varchar("name").notNull(),
  description: text("description"),
  sku: varchar("sku"),
  category: varchar("category"),
  deviceType: varchar("device_type"), // 'Phone', 'Laptop', 'Desktop', or null for 'Other'
  brand: varchar("brand"), // Device brand from auto-gen lists, or null for 'Other'
  model: varchar("model"), // Device model from auto-gen lists, or null for 'Other'
  itemType: varchar("item_type"), // 'Service' or 'Sales'
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  supplier: varchar("supplier"), // Legacy field, will be removed after migration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  check("quantity_non_negative", sql`${table.quantity} >= 0`),
  check("min_quantity_non_negative", sql`${table.minQuantity} >= 0`),
  unique("unique_sku_per_tenant").on(table.tenantId, table.sku),
]);

// Purchase orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  supplierId: varchar("supplier_id").notNull(),
  status: varchar("status").notNull().default('pending'), // 'pending', 'ordered', 'received', 'cancelled'
  orderDate: timestamp("order_date").defaultNow(),
  expectedDate: timestamp("expected_date"),
  receivedDate: timestamp("received_date"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default('0.00'),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase order items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull(),
  itemName: varchar("item_name"), // Item name stored directly in PO item - nullable during migration
  inventoryItemId: varchar("inventory_item_id"), // Nullable - linked only when PO is finalized/received
  orderedQuantity: integer("ordered_quantity").notNull(),
  receivedQuantity: integer("received_quantity").notNull().default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  deviceType: varchar("device_type"), // 'Phone', 'Laptop', 'Desktop', or null for 'Other'
  brand: varchar("brand"), // Device brand from auto-gen lists, or null for 'Other'
  model: varchar("model"), // Device model from auto-gen lists, or null for 'Other'
  itemType: varchar("item_type").notNull().default('Service'), // 'Service' or 'Sales'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inventory units table - tracks individual items with unique IDs
export const inventoryUnits = pgTable("inventory_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  supplierId: varchar("supplier_id"),
  purchaseOrderItemId: varchar("purchase_order_item_id"),
  uniqueTag: varchar("unique_tag").notNull(), // Generated unique ID for non-barcode items
  status: varchar("status").notNull().default('in_stock'), // 'in_stock', 'used', 'defective'
  deviceType: varchar("device_type"), // Inherited from PO item: 'Phone', 'Laptop', 'Desktop', or null for 'Other'
  itemType: varchar("item_type").notNull().default('Service'), // Inherited from PO item: 'Service' or 'Sales'
  description: text("description"), // Inherited from PO item
  receivedAt: timestamp("received_at").defaultNow(),
  usedAt: timestamp("used_at"),
  ticketId: varchar("ticket_id"), // Associated ticket if used in repair
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_tag_per_tenant").on(table.tenantId, table.uniqueTag),
]);

// Inventory usage tracking table
export const inventoryUsage = pgTable("inventory_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  inventoryUnitId: varchar("inventory_unit_id"), // Specific unit if tracked
  ticketId: varchar("ticket_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  usageType: varchar("usage_type").notNull().default('repair'), // 'repair', 'return', 'defective'
  cost: decimal("cost", { precision: 10, scale: 2 }),
  occurredAt: timestamp("occurred_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Ticket Items - Links tickets to service items with unit tracking
export const ticketItems = pgTable("ticket_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  ticketId: varchar("ticket_id").notNull(),
  inventoryItemId: varchar("inventory_item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // Override price or default price
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(), // quantity * unitPrice
  inventoryUnitIds: jsonb("inventory_unit_ids").default('[]'), // Array of allocated unit IDs
  confirmed: boolean("confirmed").notNull().default(false), // Confirmed as used during finalization
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

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  ticketId: varchar("ticket_id").notNull(),
  invoiceNumber: varchar("invoice_number").notNull(), // Formatted number (e.g., "INV-2025-001")
  type: varchar("type").notNull(), // 'drop_off' or 'final'
  issuedDate: timestamp("issued_date").notNull().defaultNow(),
  issuedBy: varchar("issued_by").notNull(), // User ID who generated the invoice
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: varchar("status").notNull().default('issued'), // 'issued', 'paid', 'void'
  pdfUrl: varchar("pdf_url"), // URL to stored PDF (optional)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_invoice_number_per_tenant").on(table.tenantId, table.invoiceNumber),
  index("idx_invoices_ticket").on(table.ticketId),
  index("idx_invoices_tenant").on(table.tenantId),
]);

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

// Filter presets table - stores saved filter configurations for users
export const filterPresets = pgTable("filter_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  pageType: varchar("page_type").notNull(), // 'kanban', 'inventory', 'clients', 'purchase_orders'
  filterConfig: jsonb("filter_config").notNull(), // Stores all filter values as JSON
  isDefault: boolean("is_default").notNull().default(false), // Auto-apply on page load
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_filter_presets_user").on(table.userId),
  index("idx_filter_presets_page").on(table.pageType),
  index("idx_filter_presets_tenant").on(table.tenantId),
]);

// Auto-generated lists table for AI-powered data (brands, models, etc.)
export const autoGenLists = pgTable("auto_gen_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"), // Added for multi-tenant support
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
  index("idx_auto_gen_lists_tenant_id").on(table.tenantId),
]);

// Device checklist templates - defines what components to check for each device type
export const deviceChecklistTemplates = pgTable("device_checklist_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"), // Added for multi-tenant support
  deviceType: varchar("device_type").notNull(), // e.g., 'Phone', 'Laptop', 'Desktop'
  components: text("components").array().notNull(), // Array of component names to check
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_device_checklist_type").on(table.deviceType),
  index("idx_device_checklist_templates_tenant_id").on(table.tenantId),
]);

// Device colors table - stores color information for specific devices
export const deviceColors = pgTable("device_colors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"), // Added for multi-tenant support
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
  index("idx_device_colors_tenant_id").on(table.tenantId),
]);

// Completion analytics table - tracks performance metrics and variance data for business intelligence
export const completionAnalytics = pgTable("completion_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  ticketId: varchar("ticket_id").notNull(), // Reference to completed ticket
  deviceType: varchar("device_type").notNull(), // For category analysis
  // Time tracking
  estimatedHours: integer("estimated_hours"), // Original technician estimate
  actualHours: integer("actual_hours").notNull(), // Actual time spent
  hoursVariance: integer("hours_variance").notNull(), // Actual - Estimated (positive = over, negative = under)
  hoursVariancePercentage: decimal("hours_variance_percentage", { precision: 5, scale: 2 }), // Percentage variance
  // Cost tracking  
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }), // Original cost estimation
  finalActualCost: decimal("final_actual_cost", { precision: 10, scale: 2 }).notNull(), // Final locked cost
  costVariance: decimal("cost_variance", { precision: 10, scale: 2 }).notNull(), // Final - Estimated
  costVariancePercentage: decimal("cost_variance_percentage", { precision: 5, scale: 2 }), // Percentage variance
  // Performance metrics
  accuracyScore: decimal("accuracy_score", { precision: 5, scale: 2 }), // Combined accuracy score (0-100)
  completedBy: varchar("completed_by").notNull(), // Technician who completed the work
  // Service analysis
  selectedServices: jsonb("selected_services").default('[]'), // Services that were performed
  serviceComplexity: varchar("service_complexity").default('medium'), // low, medium, high, critical
  // Business intelligence fields
  completedAt: timestamp("completed_at").notNull(), // When ticket was finalized
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_completion_analytics_tenant").on(table.tenantId),
  index("idx_completion_analytics_ticket").on(table.ticketId),
  index("idx_completion_analytics_device_type").on(table.deviceType),
  index("idx_completion_analytics_completed_by").on(table.completedBy),
  index("idx_completion_analytics_completed_at").on(table.completedAt),
  index("idx_completion_analytics_accuracy").on(table.accuracyScore),
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
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;
export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type InsertInventoryCategory = z.infer<typeof insertInventoryCategorySchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
export type InventoryUnit = typeof inventoryUnits.$inferSelect;
export type InsertInventoryUnit = typeof inventoryUnits.$inferInsert;
export type InventoryUsage = typeof inventoryUsage.$inferSelect;
export type InsertInventoryUsage = typeof inventoryUsage.$inferInsert;
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
export type RepairService = typeof repairServices.$inferSelect;
export type InsertRepairService = typeof repairServices.$inferInsert;
export type PossibleDefect = typeof possibleDefects.$inferSelect;
export type InsertPossibleDefect = typeof possibleDefects.$inferInsert;
export type Checklist = typeof checklists.$inferSelect;
export type InsertChecklist = typeof checklists.$inferInsert;
export type AuthorizationRequest = typeof authorizationRequests.$inferSelect;
export type InsertAuthorizationRequest = z.infer<typeof insertAuthorizationRequestSchema>;
export type CompletionAnalytics = typeof completionAnalytics.$inferSelect;
export type InsertCompletionAnalytics = typeof completionAnalytics.$inferInsert;
export type FilterPreset = typeof filterPresets.$inferSelect;
export type InsertFilterPreset = typeof filterPresets.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;
export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = typeof userGroups.$inferInsert;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

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

export const insertRepairServiceSchema = createInsertSchema(repairServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPossibleDefectSchema = createInsertSchema(possibleDefects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChecklistSchema = createInsertSchema(checklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuthorizationRequestSchema = createInsertSchema(authorizationRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompletionAnalyticsSchema = createInsertSchema(completionAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertFilterPresetSchema = createInsertSchema(filterPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventoryUnitSchema = createInsertSchema(inventoryUnits).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryUsageSchema = createInsertSchema(inventoryUsage).omit({
  id: true,
  createdAt: true,
});

export const insertTicketItemSchema = createInsertSchema(ticketItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTicketItem = z.infer<typeof insertTicketItemSchema>;
export type TicketItem = typeof ticketItems.$inferSelect;

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
  tenantId: varchar("tenant_id"), // Added for multi-tenant support
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
  index("idx_issue_questions_tenant_id").on(table.tenantId),
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

// ============================================
// POS (Point of Sale) / Finance Module Tables
// ============================================

// Enums for POS module
export const quoteStatusEnum = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as const;
export const posInvoiceStatusEnum = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'cancelled'] as const;
export const paymentStatusEnum = ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'] as const;
export const paymentMethodTypeEnum = ['pix', 'credit_card', 'debit_card', 'cash', 'boleto', 'bank_transfer', 'other'] as const;
export const accountTypeEnum = ['receivable', 'payable'] as const;
export const accountStatusEnum = ['pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'written_off'] as const;

// Payment Terms - Configurable payment terms for A/R
export const paymentTerms = pgTable("payment_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // e.g., "Net 15", "Net 30", "Due on Receipt"
  daysUntilDue: integer("days_until_due").notNull().default(30),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_terms_tenant").on(table.tenantId),
  unique("unique_payment_term_name_per_tenant").on(table.tenantId, table.name),
]);

// Payment Methods - Configured payment methods per tenant
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(), // 'pix', 'credit_card', 'debit_card', 'cash', 'boleto', 'bank_transfer', 'other'
  name: varchar("name").notNull(), // Display name e.g., "PIX", "Cartão de Crédito"
  description: text("description"),
  providerConfig: jsonb("provider_config").default({}), // Provider-specific settings (gateway ID, etc.)
  isActive: boolean("is_active").notNull().default(true),
  allowInstallments: boolean("allow_installments").notNull().default(false), // For credit cards
  maxInstallments: integer("max_installments").default(12),
  sortOrder: integer("sort_order").notNull().default(0), // Display order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_methods_tenant").on(table.tenantId),
  index("idx_payment_methods_type").on(table.type),
]);

// Quotes - Estimates/quotations for clients
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  quoteNumber: varchar("quote_number").notNull(), // Formatted number (e.g., "QT-2025-001")
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  ticketId: varchar("ticket_id").references(() => tickets.id, { onDelete: 'set null' }), // Optional link to repair ticket
  status: varchar("status").notNull().default('draft'), // draft, sent, accepted, rejected, expired, converted
  title: varchar("title"),
  description: text("description"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0.00'),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default('0.00'),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default('0.00'),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0.00'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  validUntil: timestamp("valid_until"), // Quote expiry date
  notes: text("notes"), // Internal notes
  termsAndConditions: text("terms_and_conditions"),
  issuedDate: timestamp("issued_date"),
  issuedBy: varchar("issued_by"), // User ID
  acceptedDate: timestamp("accepted_date"),
  convertedToInvoiceId: varchar("converted_to_invoice_id"), // Link to POS invoice if converted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_quote_number_per_tenant").on(table.tenantId, table.quoteNumber),
  index("idx_quotes_tenant").on(table.tenantId),
  index("idx_quotes_client").on(table.clientId),
  index("idx_quotes_status").on(table.status),
  index("idx_quotes_ticket").on(table.ticketId),
]);

// Quote Items - Line items for quotes
export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  description: varchar("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default('0.00'),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id, { onDelete: 'set null' }), // Optional link to inventory
  repairServiceId: varchar("repair_service_id").references(() => repairServices.id, { onDelete: 'set null' }), // Optional link to repair service
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quote_items_quote").on(table.quoteId),
]);

// Inventory Holds - Track inventory quantities reserved by quotes
export const inventoryHolds = pgTable("inventory_holds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  quoteItemId: varchar("quote_item_id").notNull().references(() => quoteItems.id, { onDelete: 'cascade' }),
  inventoryItemId: varchar("inventory_item_id").notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  quantityHeld: integer("quantity_held").notNull(),
  status: varchar("status").notNull().default('active'), // active, released, converted
  createdAt: timestamp("created_at").defaultNow(),
  releasedAt: timestamp("released_at"),
}, (table) => [
  index("idx_inventory_holds_tenant").on(table.tenantId),
  index("idx_inventory_holds_quote").on(table.quoteId),
  index("idx_inventory_holds_inventory_item").on(table.inventoryItemId),
  index("idx_inventory_holds_status").on(table.status),
]);

// POS Invoices - Standalone invoices for POS transactions (separate from repair ticket invoices)
export const posInvoices = pgTable("pos_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar("invoice_number").notNull(), // Formatted number (e.g., "POS-2025-001")
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  ticketId: varchar("ticket_id").references(() => tickets.id, { onDelete: 'set null' }), // Optional link to repair ticket
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'set null' }), // If converted from quote
  status: varchar("status").notNull().default('draft'), // draft, issued, partially_paid, paid, overdue, void, cancelled
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0.00'),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default('0.00'),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default('0.00'),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0.00'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default('0.00'), // Amount paid so far
  balanceDue: decimal("balance_due", { precision: 10, scale: 2 }).notNull().default('0.00'), // Remaining balance
  paymentTermsId: varchar("payment_terms_id").references(() => paymentTerms.id, { onDelete: 'set null' }),
  dueDate: timestamp("due_date"),
  issuedDate: timestamp("issued_date"),
  issuedBy: varchar("issued_by"), // User ID
  paidDate: timestamp("paid_date"), // When fully paid
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  pdfUrl: varchar("pdf_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_pos_invoice_number_per_tenant").on(table.tenantId, table.invoiceNumber),
  index("idx_pos_invoices_tenant").on(table.tenantId),
  index("idx_pos_invoices_client").on(table.clientId),
  index("idx_pos_invoices_status").on(table.status),
  index("idx_pos_invoices_due_date").on(table.dueDate),
]);

// POS Invoice Items - Line items for POS invoices
export const posInvoiceItems = pgTable("pos_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => posInvoices.id, { onDelete: 'cascade' }),
  description: varchar("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default('0.00'),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id, { onDelete: 'set null' }),
  repairServiceId: varchar("repair_service_id").references(() => repairServices.id, { onDelete: 'set null' }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pos_invoice_items_invoice").on(table.invoiceId),
]);

// Payments - Transaction records for all payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  paymentNumber: varchar("payment_number").notNull(), // Reference number (e.g., "PAY-2025-001")
  posInvoiceId: varchar("pos_invoice_id").references(() => posInvoices.id, { onDelete: 'set null' }), // Link to POS invoice
  ticketId: varchar("ticket_id").references(() => tickets.id, { onDelete: 'set null' }), // Or link to repair ticket
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'set null' }),
  paymentMethodId: varchar("payment_method_id").references(() => paymentMethods.id, { onDelete: 'set null' }),
  paymentMethodType: varchar("payment_method_type").notNull(), // 'pix', 'credit_card', 'debit_card', 'cash', etc.
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default('pending'), // pending, processing, completed, failed, refunded, cancelled
  // Gateway details
  gatewayProvider: varchar("gateway_provider"), // 'stripe', 'pagar_me', 'manual', etc.
  gatewayTransactionId: varchar("gateway_transaction_id"), // External transaction ID
  gatewayResponse: jsonb("gateway_response").default({}), // Full response from gateway
  // Installment details (for credit cards)
  installments: integer("installments").default(1),
  installmentAmount: decimal("installment_amount", { precision: 10, scale: 2 }),
  // PIX specific
  pixQrCode: text("pix_qr_code"), // QR code data
  pixQrCodeUrl: varchar("pix_qr_code_url"), // URL to QR code image
  pixExpiresAt: timestamp("pix_expires_at"),
  // Processing details
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by"), // User ID who processed
  failureReason: text("failure_reason"),
  refundedAt: timestamp("refunded_at"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  refundReason: text("refund_reason"),
  referenceNumber: varchar("reference_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_payment_number_per_tenant").on(table.tenantId, table.paymentNumber),
  index("idx_payments_tenant").on(table.tenantId),
  index("idx_payments_invoice").on(table.posInvoiceId),
  index("idx_payments_ticket").on(table.ticketId),
  index("idx_payments_client").on(table.clientId),
  index("idx_payments_status").on(table.status),
  index("idx_payments_gateway_tx").on(table.gatewayTransactionId),
]);

// Accounts Receivable - Money owed TO the business
export const accountsReceivable = pgTable("accounts_receivable", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  posInvoiceId: varchar("pos_invoice_id").references(() => posInvoices.id, { onDelete: 'set null' }),
  ticketId: varchar("ticket_id").references(() => tickets.id, { onDelete: 'set null' }),
  description: varchar("description").notNull(),
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  balanceDue: decimal("balance_due", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default('pending'), // pending, partially_paid, paid, overdue, cancelled, written_off
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  paymentTermsId: varchar("payment_terms_id").references(() => paymentTerms.id, { onDelete: 'set null' }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ar_tenant").on(table.tenantId),
  index("idx_ar_client").on(table.clientId),
  index("idx_ar_status").on(table.status),
  index("idx_ar_due_date").on(table.dueDate),
]);

// Accounts Payable - Money owed BY the business
export const accountsPayable = pgTable("accounts_payable", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  supplierId: varchar("supplier_id").references(() => suppliers.id, { onDelete: 'set null' }),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id, { onDelete: 'set null' }),
  description: varchar("description").notNull(),
  category: varchar("category"), // 'inventory', 'utilities', 'rent', 'services', 'other'
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default('0.00'),
  balanceDue: decimal("balance_due", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default('pending'), // pending, partially_paid, paid, overdue, cancelled
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  paymentMethod: varchar("payment_method"), // How it was/will be paid
  referenceNumber: varchar("reference_number"), // External reference (supplier invoice number, etc.)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ap_tenant").on(table.tenantId),
  index("idx_ap_supplier").on(table.supplierId),
  index("idx_ap_status").on(table.status),
  index("idx_ap_due_date").on(table.dueDate),
  index("idx_ap_category").on(table.category),
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

// Signature request schemas and types
export const insertSignatureRequestSchema = createInsertSchema(signatureRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type InsertSignatureRequest = z.infer<typeof insertSignatureRequestSchema>;
export type SignatureRequestStatus = (typeof signatureRequestStatusEnum)[number];
export type SignatureRequestType = (typeof signatureRequestTypeEnum)[number];

// Signature audit event schemas and types
export const insertSignatureAuditEventSchema = createInsertSchema(signatureAuditEvents).omit({
  id: true,
  createdAt: true,
});

export type SignatureAuditEvent = typeof signatureAuditEvents.$inferSelect;
export type InsertSignatureAuditEvent = z.infer<typeof insertSignatureAuditEventSchema>;
export type SignatureAuditEventType = (typeof signatureAuditEventTypeEnum)[number];

// ============================================
// POS Module Schemas and Types
// ============================================

// Payment Terms
export const insertPaymentTermSchema = createInsertSchema(paymentTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PaymentTerm = typeof paymentTerms.$inferSelect;
export type InsertPaymentTerm = z.infer<typeof insertPaymentTermSchema>;

// Payment Methods
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

// Quotes
export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

// Quote Items
export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({
  id: true,
  createdAt: true,
});
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;

// Inventory Holds
export const insertInventoryHoldSchema = createInsertSchema(inventoryHolds).omit({
  id: true,
  createdAt: true,
  releasedAt: true,
});
export type InventoryHold = typeof inventoryHolds.$inferSelect;
export type InsertInventoryHold = z.infer<typeof insertInventoryHoldSchema>;

// POS Invoices
export const insertPosInvoiceSchema = createInsertSchema(posInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PosInvoice = typeof posInvoices.$inferSelect;
export type InsertPosInvoice = z.infer<typeof insertPosInvoiceSchema>;

// POS Invoice Items
export const insertPosInvoiceItemSchema = createInsertSchema(posInvoiceItems).omit({
  id: true,
  createdAt: true,
});
export type PosInvoiceItem = typeof posInvoiceItems.$inferSelect;
export type InsertPosInvoiceItem = z.infer<typeof insertPosInvoiceItemSchema>;

// Payments
export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Accounts Receivable
export const insertAccountReceivableSchema = createInsertSchema(accountsReceivable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AccountReceivable = typeof accountsReceivable.$inferSelect;
export type InsertAccountReceivable = z.infer<typeof insertAccountReceivableSchema>;

// Accounts Payable
export const insertAccountPayableSchema = createInsertSchema(accountsPayable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AccountPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountPayable = z.infer<typeof insertAccountPayableSchema>;

// POS Enum Types
export type QuoteStatus = (typeof quoteStatusEnum)[number];
export type PosInvoiceStatus = (typeof posInvoiceStatusEnum)[number];
export type PaymentStatus = (typeof paymentStatusEnum)[number];
export type PaymentMethodType = (typeof paymentMethodTypeEnum)[number];
export type AccountType = (typeof accountTypeEnum)[number];
export type AccountStatus = (typeof accountStatusEnum)[number];

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
  repairServices: many(repairServices),
  possibleDefects: many(possibleDefects),
  // POS relations
  paymentTerms: many(paymentTerms),
  paymentMethods: many(paymentMethods),
  quotes: many(quotes),
  posInvoices: many(posInvoices),
  payments: many(payments),
  accountsReceivable: many(accountsReceivable),
  accountsPayable: many(accountsPayable),
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

export const repairServiceRelations = relations(repairServices, ({ one }) => ({
  tenant: one(tenants, {
    fields: [repairServices.tenantId],
    references: [tenants.id],
  }),
}));

export const possibleDefectRelations = relations(possibleDefects, ({ one }) => ({
  tenant: one(tenants, {
    fields: [possibleDefects.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================
// POS Module Relations
// ============================================

export const paymentTermRelations = relations(paymentTerms, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentTerms.tenantId],
    references: [tenants.id],
  }),
}));

export const paymentMethodRelations = relations(paymentMethods, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentMethods.tenantId],
    references: [tenants.id],
  }),
}));

export const quoteRelations = relations(quotes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [quotes.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  ticket: one(tickets, {
    fields: [quotes.ticketId],
    references: [tickets.id],
  }),
  items: many(quoteItems),
}));

export const quoteItemRelations = relations(quoteItems, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [quoteItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
  repairService: one(repairServices, {
    fields: [quoteItems.repairServiceId],
    references: [repairServices.id],
  }),
  holds: many(inventoryHolds),
}));

export const inventoryHoldRelations = relations(inventoryHolds, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inventoryHolds.tenantId],
    references: [tenants.id],
  }),
  quote: one(quotes, {
    fields: [inventoryHolds.quoteId],
    references: [quotes.id],
  }),
  quoteItem: one(quoteItems, {
    fields: [inventoryHolds.quoteItemId],
    references: [quoteItems.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [inventoryHolds.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const posInvoiceRelations = relations(posInvoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [posInvoices.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [posInvoices.clientId],
    references: [clients.id],
  }),
  ticket: one(tickets, {
    fields: [posInvoices.ticketId],
    references: [tickets.id],
  }),
  quote: one(quotes, {
    fields: [posInvoices.quoteId],
    references: [quotes.id],
  }),
  paymentTerms: one(paymentTerms, {
    fields: [posInvoices.paymentTermsId],
    references: [paymentTerms.id],
  }),
  items: many(posInvoiceItems),
  payments: many(payments),
}));

export const posInvoiceItemRelations = relations(posInvoiceItems, ({ one }) => ({
  invoice: one(posInvoices, {
    fields: [posInvoiceItems.invoiceId],
    references: [posInvoices.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [posInvoiceItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
  repairService: one(repairServices, {
    fields: [posInvoiceItems.repairServiceId],
    references: [repairServices.id],
  }),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  posInvoice: one(posInvoices, {
    fields: [payments.posInvoiceId],
    references: [posInvoices.id],
  }),
  ticket: one(tickets, {
    fields: [payments.ticketId],
    references: [tickets.id],
  }),
  client: one(clients, {
    fields: [payments.clientId],
    references: [clients.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [payments.paymentMethodId],
    references: [paymentMethods.id],
  }),
}));

export const accountReceivableRelations = relations(accountsReceivable, ({ one }) => ({
  tenant: one(tenants, {
    fields: [accountsReceivable.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [accountsReceivable.clientId],
    references: [clients.id],
  }),
  posInvoice: one(posInvoices, {
    fields: [accountsReceivable.posInvoiceId],
    references: [posInvoices.id],
  }),
  ticket: one(tickets, {
    fields: [accountsReceivable.ticketId],
    references: [tickets.id],
  }),
  paymentTerms: one(paymentTerms, {
    fields: [accountsReceivable.paymentTermsId],
    references: [paymentTerms.id],
  }),
}));

export const accountPayableRelations = relations(accountsPayable, ({ one }) => ({
  tenant: one(tenants, {
    fields: [accountsPayable.tenantId],
    references: [tenants.id],
  }),
  supplier: one(suppliers, {
    fields: [accountsPayable.supplierId],
    references: [suppliers.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [accountsPayable.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));
