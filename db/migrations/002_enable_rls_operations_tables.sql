-- Migration: Enable RLS for Operations Tables
-- Description: Implements row-level security for tickets, clients, inventory, purchases, and transactions
-- Date: 2025-11-10

-- ============================================================================
-- STORE SETTINGS TABLE
-- ============================================================================
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON store_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON clients
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- TICKETS TABLE
-- ============================================================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tickets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- TICKET_NOTES TABLE
-- ============================================================================
ALTER TABLE ticket_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON ticket_notes
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- TICKET_ITEMS TABLE
-- ============================================================================
ALTER TABLE ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_items FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON ticket_items
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- AUTHORIZATION_REQUESTS TABLE
-- ============================================================================
ALTER TABLE authorization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON authorization_requests
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- WARRANTY_TIERS TABLE
-- ============================================================================
ALTER TABLE warranty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_tiers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON warranty_tiers
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- REPAIR_SERVICES TABLE
-- ============================================================================
ALTER TABLE repair_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_services FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON repair_services
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- POSSIBLE_DEFECTS TABLE
-- ============================================================================
ALTER TABLE possible_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE possible_defects FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON possible_defects
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- CHECKLISTS TABLE
-- ============================================================================
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON checklists
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SUPPLIERS TABLE
-- ============================================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON suppliers
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- INVENTORY_CATEGORIES TABLE
-- ============================================================================
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON inventory_categories
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- INVENTORY_ITEMS TABLE
-- ============================================================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON inventory_items
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- INVENTORY_UNITS TABLE
-- ============================================================================
ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_units FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON inventory_units
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- INVENTORY_USAGE TABLE
-- ============================================================================
ALTER TABLE inventory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_usage FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON inventory_usage
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- PURCHASE_ORDERS TABLE
-- ============================================================================
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON purchase_orders
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- PURCHASE_ORDER_ITEMS TABLE
-- ============================================================================
-- Note: This table doesn't have tenant_id in current schema, relies on FK to purchase_orders
-- RLS will cascade through the join to purchase_orders
-- For direct queries, we'll need to add tenant_id or use joins

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON transactions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- SUPPORT_TICKETS TABLE
-- ============================================================================
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON support_tickets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- FILTER_PRESETS TABLE
-- ============================================================================
ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_presets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON filter_presets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- COMPLETION_ANALYTICS TABLE
-- ============================================================================
ALTER TABLE completion_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE completion_analytics FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON completion_analytics
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- INDEXES FOR RLS PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_store_settings_tenant_id ON store_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_notes_tenant_id ON ticket_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_tenant_id ON ticket_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_authorization_requests_tenant_id ON authorization_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warranty_tiers_tenant_id ON warranty_tiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_repair_services_tenant_id ON repair_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_possible_defects_tenant_id ON possible_defects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checklists_tenant_id ON checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_tenant_id ON inventory_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_id ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_tenant_id ON inventory_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_tenant_id ON inventory_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_filter_presets_tenant_id ON filter_presets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_completion_analytics_tenant_id ON completion_analytics(tenant_id);

-- Composite indexes for common FK + tenantId joins
CREATE INDEX IF NOT EXISTS idx_tickets_client_tenant ON tickets(client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_item_tenant ON inventory_units(inventory_item_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket_tenant ON ticket_items(ticket_id, tenant_id);
