-- Migration: Enable RLS for Shared/Mixed-Scope Data Tables
-- Description: Implements dual-policy RLS for tables with nullable tenant_id (global + tenant-specific data)
-- Date: 2025-11-10

-- ============================================================================
-- AUTO_GEN_LISTS TABLE (nullable tenant_id)
-- Mixed scope: Global system lists + tenant-specific custom lists
-- ============================================================================
ALTER TABLE auto_gen_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_gen_lists FORCE ROW LEVEL SECURITY;

-- Allow all tenants to READ global lists (tenant_id IS NULL)
CREATE POLICY global_read_policy ON auto_gen_lists FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::text);

-- Allow INSERT/UPDATE/DELETE only for tenant-specific lists
CREATE POLICY tenant_write_policy ON auto_gen_lists FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_update_policy ON auto_gen_lists FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_delete_policy ON auto_gen_lists FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- DEVICE_CHECKLIST_TEMPLATES TABLE (nullable tenant_id)
-- Mixed scope: Global templates + tenant-specific templates
-- ============================================================================
ALTER TABLE device_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_checklist_templates FORCE ROW LEVEL SECURITY;

-- Allow all tenants to READ global templates (tenant_id IS NULL)
CREATE POLICY global_read_policy ON device_checklist_templates FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::text);

-- Allow INSERT/UPDATE/DELETE only for tenant-specific templates
CREATE POLICY tenant_write_policy ON device_checklist_templates FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_update_policy ON device_checklist_templates FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_delete_policy ON device_checklist_templates FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- DEVICE_COLORS TABLE (nullable tenant_id)
-- Mixed scope: Global color library + tenant-specific colors
-- ============================================================================
ALTER TABLE device_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_colors FORCE ROW LEVEL SECURITY;

-- Allow all tenants to READ global colors (tenant_id IS NULL)
CREATE POLICY global_read_policy ON device_colors FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::text);

-- Allow INSERT/UPDATE/DELETE only for tenant-specific colors
CREATE POLICY tenant_write_policy ON device_colors FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_update_policy ON device_colors FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_delete_policy ON device_colors FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- ISSUE_QUESTIONS TABLE (nullable tenant_id)
-- Mixed scope: Global question templates + tenant-specific questions
-- ============================================================================
ALTER TABLE issue_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_questions FORCE ROW LEVEL SECURITY;

-- Allow all tenants to READ global questions (tenant_id IS NULL)
CREATE POLICY global_read_policy ON issue_questions FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::text);

-- Allow INSERT/UPDATE/DELETE only for tenant-specific questions
CREATE POLICY tenant_write_policy ON issue_questions FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_update_policy ON issue_questions FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

CREATE POLICY tenant_delete_policy ON issue_questions FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- INDEXES FOR RLS PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_auto_gen_lists_tenant_id ON auto_gen_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_checklist_templates_tenant_id ON device_checklist_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_colors_tenant_id ON device_colors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_issue_questions_tenant_id ON issue_questions(tenant_id);
