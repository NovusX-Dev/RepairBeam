#!/usr/bin/env tsx
/**
 * RLS Migration Runner
 * 
 * Applies PostgreSQL Row-Level Security policies to all multi-tenant tables.
 * Run this script to enable RLS for the first time or after schema changes.
 * 
 * Usage: npm run migrate:rls
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const MIGRATION_FILES = [
  '001_enable_rls_auth_tables.sql',
  '002_enable_rls_operations_tables.sql',
  '003_enable_rls_gamification_tables.sql',
  '004_enable_rls_shared_data_tables.sql',
];

async function applyMigrations() {
  console.log('🔒 Starting RLS Policy Migration...\n');

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(__dirname, 'migrations', file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${file}`);
      process.exit(1);
    }

    console.log(`📝 Applying migration: ${file}`);
    
    try {
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      
      // Execute the SQL file
      await db.execute(sql.raw(sqlContent));
      
      console.log(`✅ Successfully applied: ${file}\n`);
    } catch (error) {
      console.error(`❌ Failed to apply migration: ${file}`);
      console.error(error);
      process.exit(1);
    }
  }

  console.log('✨ All RLS policies have been successfully applied!');
  console.log('\n📋 Summary:');
  console.log('- Row-Level Security (RLS) is now ENABLED and FORCED on all multi-tenant tables');
  console.log('- Tenant isolation policies are active');
  console.log('- Shared data tables (device_colors, auto_gen_lists, etc.) have dual policies');
  console.log('- Performance indexes have been created');
  console.log('\n⚠️  Important:');
  console.log('- Ensure app.current_tenant_id session variable is set on every request');
  console.log('- Test cross-tenant access to verify isolation is working');
  console.log('- Monitor query performance and add indexes if needed');
  
  process.exit(0);
}

applyMigrations().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
