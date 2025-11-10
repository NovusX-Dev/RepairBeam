-- Migration: Rollback ALL RLS Policies (EMERGENCY USE ONLY)
-- Description: Disables all RLS policies and row-level security
-- WARNING: This exposes all tenant data. Use only for emergency debugging.
-- Date: 2025-11-10

-- ============================================================================
-- DROP ALL POLICIES AND DISABLE RLS
-- ============================================================================

-- Auth Tables
DROP POLICY IF EXISTS tenant_isolation_policy ON users;
DROP POLICY IF EXISTS tenant_self_view_policy ON tenants;
DROP POLICY IF EXISTS tenant_self_update_policy ON tenants;
DROP POLICY IF EXISTS tenant_isolation_policy ON groups;
DROP POLICY IF EXISTS tenant_isolation_policy ON user_groups;
DROP POLICY IF EXISTS tenant_isolation_policy ON user_invitations;
DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Operations Tables
DROP POLICY IF EXISTS tenant_isolation_policy ON store_settings;
DROP POLICY IF EXISTS tenant_isolation_policy ON clients;
DROP POLICY IF EXISTS tenant_isolation_policy ON tickets;
DROP POLICY IF EXISTS tenant_isolation_policy ON ticket_notes;
DROP POLICY IF EXISTS tenant_isolation_policy ON ticket_items;
DROP POLICY IF EXISTS tenant_isolation_policy ON authorization_requests;
DROP POLICY IF EXISTS tenant_isolation_policy ON warranty_tiers;
DROP POLICY IF EXISTS tenant_isolation_policy ON repair_services;
DROP POLICY IF EXISTS tenant_isolation_policy ON possible_defects;
DROP POLICY IF EXISTS tenant_isolation_policy ON checklists;
DROP POLICY IF EXISTS tenant_isolation_policy ON suppliers;
DROP POLICY IF EXISTS tenant_isolation_policy ON inventory_categories;
DROP POLICY IF EXISTS tenant_isolation_policy ON inventory_items;
DROP POLICY IF EXISTS tenant_isolation_policy ON inventory_units;
DROP POLICY IF EXISTS tenant_isolation_policy ON inventory_usage;
DROP POLICY IF EXISTS tenant_isolation_policy ON purchase_orders;
DROP POLICY IF EXISTS tenant_isolation_policy ON transactions;
DROP POLICY IF EXISTS tenant_isolation_policy ON support_tickets;
DROP POLICY IF EXISTS tenant_isolation_policy ON filter_presets;
DROP POLICY IF EXISTS tenant_isolation_policy ON completion_analytics;

ALTER TABLE store_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_tiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE repair_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE possible_defects DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE filter_presets DISABLE ROW LEVEL SECURITY;
ALTER TABLE completion_analytics DISABLE ROW LEVEL SECURITY;

-- Gamification Tables
DROP POLICY IF EXISTS tenant_isolation_policy ON user_progress;
DROP POLICY IF EXISTS tenant_isolation_policy ON achievements;
DROP POLICY IF EXISTS tenant_isolation_policy ON user_achievements;
DROP POLICY IF EXISTS tenant_isolation_policy ON user_activities;

ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities DISABLE ROW LEVEL SECURITY;

-- Shared Data Tables
DROP POLICY IF EXISTS global_read_policy ON auto_gen_lists;
DROP POLICY IF EXISTS tenant_write_policy ON auto_gen_lists;
DROP POLICY IF EXISTS tenant_update_policy ON auto_gen_lists;
DROP POLICY IF EXISTS tenant_delete_policy ON auto_gen_lists;

DROP POLICY IF EXISTS global_read_policy ON device_checklist_templates;
DROP POLICY IF EXISTS tenant_write_policy ON device_checklist_templates;
DROP POLICY IF EXISTS tenant_update_policy ON device_checklist_templates;
DROP POLICY IF EXISTS tenant_delete_policy ON device_checklist_templates;

DROP POLICY IF EXISTS global_read_policy ON device_colors;
DROP POLICY IF EXISTS tenant_write_policy ON device_colors;
DROP POLICY IF EXISTS tenant_update_policy ON device_colors;
DROP POLICY IF EXISTS tenant_delete_policy ON device_colors;

DROP POLICY IF EXISTS global_read_policy ON issue_questions;
DROP POLICY IF EXISTS tenant_write_policy ON issue_questions;
DROP POLICY IF EXISTS tenant_update_policy ON issue_questions;
DROP POLICY IF EXISTS tenant_delete_policy ON issue_questions;

ALTER TABLE auto_gen_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_checklist_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_colors DISABLE ROW LEVEL SECURITY;
ALTER TABLE issue_questions DISABLE ROW LEVEL SECURITY;
