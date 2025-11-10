import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Tenant Context Middleware
 * 
 * Sets the PostgreSQL session variable 'app.current_tenant_id' for RLS policies.
 * This MUST run after authentication middleware so req.user is available.
 * 
 * Uses SET LOCAL (not SET) to ensure the variable is automatically cleared
 * at transaction end, preventing cross-request contamination in connection pools.
 */
export async function setTenantContext(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip for unauthenticated routes or missing authUser
    // authUser should be populated by hydrateAuthUser middleware
    if (!req.authUser || !req.authUser.tenantId) {
      return next();
    }

    const tenantId = req.authUser.tenantId;

    // Set the tenant context for this request's database queries
    // Using SET LOCAL ensures it's automatically cleared at transaction end
    // Note: SET commands don't support parameterized queries, so we use sql.raw with proper escaping
    const escapedTenantId = tenantId.replace(/'/g, "''");
    await db.execute(sql.raw(`SET LOCAL app.current_tenant_id = '${escapedTenantId}'`));

    // Clean up on response finish to ensure session variable is cleared
    res.on('finish', async () => {
      try {
        // Additional safety: explicitly reset the session variable
        // This is belt-and-suspenders since SET LOCAL should auto-clear
        await db.execute(sql`RESET app.current_tenant_id`);
      } catch (error) {
        // Log but don't throw - response is already sent
        console.error('[RLS] Failed to reset tenant context:', error);
      }
    });

    next();
  } catch (error) {
    console.error('[RLS] Failed to set tenant context:', error);
    // Continue without tenant context - RLS will block queries
    // Better to fail closed than expose data
    next();
  }
}

/**
 * Helper function to manually set tenant context for background jobs
 * 
 * Usage:
 * ```
 * await withTenantContext(tenantId, async () => {
 *   // Your tenant-scoped queries here
 *   const tickets = await storage.getTickets(tenantId);
 * });
 * ```
 */
export async function withTenantContext<T>(
  tenantId: string,
  callback: () => Promise<T>
): Promise<T> {
  try {
    // Set tenant context
    // Note: SET commands don't support parameterized queries, so we use sql.raw with proper escaping
    const escapedTenantId = tenantId.replace(/'/g, "''");
    await db.execute(sql.raw(`SET LOCAL app.current_tenant_id = '${escapedTenantId}'`));
    
    // Execute callback
    const result = await callback();
    
    // Reset context
    await db.execute(sql`RESET app.current_tenant_id`);
    
    return result;
  } catch (error) {
    // Ensure cleanup even on error
    try {
      await db.execute(sql`RESET app.current_tenant_id`);
    } catch (resetError) {
      console.error('[RLS] Failed to reset tenant context after error:', resetError);
    }
    throw error;
  }
}
