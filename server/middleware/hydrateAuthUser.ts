import { Request, Response, NextFunction } from 'express';
import { type AuthenticatedUser } from '../types/express.js';
import { getAuthenticatedUserId } from '../utils/auth.js';

/**
 * Authentication Hydration Middleware
 * 
 * Copies the authenticated user from req.user to req.authUser for consistent access.
 * Passport's deserializeUser already loads the full database user record into req.user.
 * This middleware ensures that req.authUser is populated for route handlers.
 * 
 * MUST run after authentication middleware (setupAuth) but before routes.
 */
export async function hydrateAuthUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip unauthenticated requests
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return next();
    }

    // Fail if authenticated but req.user is missing (should never happen)
    if (!req.user) {
      console.error('[Auth] Session authenticated but req.user is missing');
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Skip if already hydrated (e.g., in middleware chain)
    if (req.authUser) {
      return next();
    }

    // Passport's deserializeUser has already loaded the full database user
    // Simply copy it to req.authUser for consistent access across routes
    const user = req.user as AuthenticatedUser;
    
    // Extract user ID for validation
    const userId = getAuthenticatedUserId(user);
    if (!userId) {
      console.error('[Auth] Missing user ID in authenticated session');
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Directly assign req.user to req.authUser (no redundant DB fetch)
    req.authUser = user as any; // Cast to match expected type
    req.userTenantId = user.tenantId;

    next();
  } catch (error) {
    console.error('[Auth] Failed to hydrate user:', error);
    // Fail closed - don't continue without auth context
    return res.status(401).json({ message: "Unauthorized" });
  }
}
