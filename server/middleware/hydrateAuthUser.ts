import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { type AuthenticatedUser } from '../types/express.js';
import { getAuthenticatedUserId } from '../utils/auth.js';

/**
 * Authentication Hydration Middleware
 * 
 * Fetches the database User record once per request and caches it on req.authUser.
 * This eliminates the need for routes to repeatedly query storage.getUser().
 * Supports both OIDC and local (password-based) authentication.
 * 
 * MUST run after authentication middleware (setupAuth) but before routes.
 */
export async function hydrateAuthUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip if not authenticated or user already hydrated
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return next();
    }

    // Skip if already hydrated (e.g., in middleware chain)
    if (req.authUser) {
      return next();
    }

    // Extract user ID from either OIDC or local auth user
    const user = req.user as AuthenticatedUser;
    const userId = getAuthenticatedUserId(user);

    if (!userId) {
      console.error('[Auth] Missing user ID in claims');
      return next();
    }

    // Fetch database user record
    const dbUser = await storage.getUser(userId);

    if (!dbUser) {
      // User exists in OIDC but not in database
      // This might happen during first login
      console.warn(`[Auth] User ${userId} authenticated but not found in database`);
      return next();
    }

    // Cache user on request object
    req.authUser = dbUser;
    req.userTenantId = dbUser.tenantId;

    next();
  } catch (error) {
    console.error('[Auth] Failed to hydrate user:', error);
    // Continue without hydrated user - routes will handle missing authUser
    next();
  }
}
