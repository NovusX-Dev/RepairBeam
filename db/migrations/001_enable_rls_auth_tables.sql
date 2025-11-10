-- Migration: Enable RLS for Core Authentication & Authorization Tables
-- Description: Implements row-level security policies for users, groups, permissions, and audit logs
-- Date: 2025-11-10

-- ============================================================================
-- USERS TABLE
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Users can only see/modify users in their own tenant
CREATE POLICY tenant_isolation_policy ON users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

-- Users can only see their own tenant
CREATE POLICY tenant_self_view_policy ON tenants
  USING (id = current_setting('app.current_tenant_id', true)::text);

-- Only allow updates to own tenant (prevent tenant ID changes)
CREATE POLICY tenant_self_update_policy ON tenants FOR UPDATE
  USING (id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- GROUPS TABLE
-- ============================================================================
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON groups
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- USER_GROUPS TABLE
-- ============================================================================
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON user_groups
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- USER_INVITATIONS TABLE
-- ============================================================================
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON user_invitations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON audit_logs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- INDEXES FOR RLS PERFORMANCE
-- ============================================================================
-- Ensure all tables have indexes on tenant_id for efficient RLS filtering
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_groups_tenant_id ON groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_tenant_id ON user_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant_id ON user_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
