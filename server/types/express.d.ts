import { User as DbUser } from "@shared/schema";

declare global {
  namespace Express {
    // Extend the Express Request interface
    interface Request {
      // Cached database user fetched once per request
      authUser?: DbUser;
      // Convenience accessor for tenant ID
      userTenantId?: string;
    }

    // Authenticated user from Replit OIDC (Passport user)
    interface User {
      claims: {
        sub: string;
        [key: string]: any;
      };
    }
  }
}

// Utility type for OIDC authenticated user
export type OidcUser = Express.User & {
  claims: {
    sub: string;
  };
};
