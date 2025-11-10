import { User as DbUser } from "@shared/schema";

// Session user minimal data persisted in session
export interface SessionUser {
  id: string;
  tenantId: string;
  authProvider: 'oidc' | 'local';
}

// Authenticated user enriched with auth context
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tenantId: string;
  authProvider: 'oidc' | 'local';
  mustChangePassword: boolean;
  claims?: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    exp?: number;
  };
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

declare global {
  namespace Express {
    // Extend the Express Request interface
    interface Request {
      // Cached database user fetched once per request
      authUser?: DbUser;
      // Convenience accessor for tenant ID
      userTenantId?: string;
    }

    // Authenticated user from both OIDC and Local strategies
    type User = AuthenticatedUser;
  }
}

export {};
