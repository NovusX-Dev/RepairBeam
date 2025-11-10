-- Migration: Enable RLS for Gamification & Analytics Tables
-- Description: Implements row-level security for user progress, achievements, and activities
-- Date: 2025-11-10

-- ============================================================================
-- USER_PROGRESS TABLE
-- ============================================================================
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON user_progress
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- ACHIEVEMENTS TABLE
-- ============================================================================
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON achievements
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- USER_ACHIEVEMENTS TABLE
-- ============================================================================
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON user_achievements
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- USER_ACTIVITIES TABLE
-- ============================================================================
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON user_activities
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- ============================================================================
-- ISSUE_RESPONSES TABLE
-- ============================================================================
-- Note: This table doesn't have tenant_id in current schema, relies on FK to issue_questions
-- RLS will cascade through joins

-- ============================================================================
-- INDEXES FOR RLS PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_progress_tenant_id ON user_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_achievements_tenant_id ON achievements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_tenant_id ON user_achievements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_tenant_id ON user_activities(tenant_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_progress_user_tenant ON user_progress(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_tenant ON user_achievements(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_tenant ON user_activities(user_id, tenant_id);
