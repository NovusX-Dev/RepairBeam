import { User as DbUser } from "@shared/schema";

// Session user minimal data persisted in session
export interface SessionUser {
  id: string;
  tenantId: string;
  authProvider: 'oidc' | 'local';
  // OIDC-specific session data
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

// Base authenticated user properties shared by both auth types
interface BaseAuthenticatedUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tenantId: string;
  mustChangePassword: boolean;
}

// OIDC authenticated user with token metadata
export interface OidcAuthenticatedUser extends BaseAuthenticatedUser {
  authProvider: 'oidc';
  claims: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    exp?: number;
  };
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

// Local authenticated user (password-based)
export interface LocalAuthenticatedUser extends BaseAuthenticatedUser {
  authProvider: 'local';
  claims?: never;
  access_token?: never;
  refresh_token?: never;
  expires_at?: never;
}

// Discriminated union of both auth types
export type AuthenticatedUser = OidcAuthenticatedUser | LocalAuthenticatedUser;

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
    interface User extends BaseAuthenticatedUser {
      authProvider: 'oidc' | 'local';
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
  }
}

export {};
