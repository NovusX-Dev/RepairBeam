import type { Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "./storage";
import type { Permission } from "@shared/permissions";
import { hasPermission, hasAnyPermission } from "@shared/permissions";

/**
 * Middleware to check if the authenticated user has the required permission
 * 
 * Usage:
 *   app.get("/api/groups", isAuthenticated, requirePermission(PERMISSIONS.GROUPS_READ), handler)
 *   app.post("/api/groups", isAuthenticated, requirePermission(PERMISSIONS.GROUPS_CREATE), handler)
 * 
 * @param requiredPermission - The permission required to access the route
 * @returns Express middleware function
 */
export function requirePermission(requiredPermission: Permission): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use hydrated authUser (populated by hydrateAuthUser middleware)
      const authUser = (req as any).authUser;
      
      if (!authUser || !authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized: User not authenticated" });
      }

      // Get user permissions (authUser already has the full DB user record)
      const userPermissions = await storage.getUserPermissions(authUser.id, authUser.tenantId);

      // Check if user has the required permission
      if (!hasPermission(userPermissions, requiredPermission)) {
        return res.status(403).json({ 
          message: "Forbidden: Insufficient permissions",
          required: requiredPermission,
        });
      }

      // Attach permissions to request for potential use in route handler
      (req as any).userPermissions = userPermissions;
      (req as any).userId = authUser.id;
      (req as any).tenantId = authUser.tenantId;

      next();
    } catch (error) {
      console.error("Error in requirePermission middleware:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

/**
 * Middleware to check if the authenticated user has any of the required permissions (OR logic)
 * 
 * Usage:
 *   app.get("/api/data", isAuthenticated, requireAnyPermission([PERMISSIONS.DATA_READ, PERMISSIONS.DATA_ADMIN]), handler)
 * 
 * @param requiredPermissions - Array of permissions (user needs at least one)
 * @returns Express middleware function
 */
export function requireAnyPermission(requiredPermissions: Permission[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use hydrated authUser (populated by hydrateAuthUser middleware)
      const authUser = (req as any).authUser;
      
      if (!authUser || !authUser.tenantId) {
        return res.status(401).json({ message: "Unauthorized: User not authenticated" });
      }

      // Get user permissions (authUser already has the full DB user record)
      const userPermissions = await storage.getUserPermissions(authUser.id, authUser.tenantId);

      // Check if user has any of the required permissions
      if (!hasAnyPermission(userPermissions, requiredPermissions)) {
        return res.status(403).json({ 
          message: "Forbidden: Insufficient permissions",
          requiredAny: requiredPermissions,
        });
      }

      // Attach permissions to request for potential use in route handler
      (req as any).userPermissions = userPermissions;
      (req as any).userId = authUser.id;
      (req as any).tenantId = authUser.tenantId;

      next();
    } catch (error) {
      console.error("Error in requireAnyPermission middleware:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}

/**
 * Optional: Helper to check permissions within route handlers without middleware
 * 
 * @param userId - The user ID
 * @param tenantId - The tenant ID
 * @param requiredPermission - The permission to check
 * @returns Promise<boolean>
 */
export async function checkUserPermission(
  userId: string,
  tenantId: string,
  requiredPermission: Permission
): Promise<boolean> {
  try {
    const userPermissions = await storage.getUserPermissions(userId, tenantId);
    return hasPermission(userPermissions, requiredPermission);
  } catch (error) {
    console.error("Error checking user permission:", error);
    return false;
  }
}
