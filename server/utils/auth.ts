import type { AuthenticatedUser } from '../types/express.js';

/**
 * Extract user ID from either OIDC or local authenticated user
 * 
 * @param user - The authenticated user (OIDC or local)
 * @returns The user ID string
 */
export function getAuthenticatedUserId(user: AuthenticatedUser): string {
  if (user.authProvider === 'local') {
    return user.id;
  } else {
    return user.claims.sub;
  }
}
