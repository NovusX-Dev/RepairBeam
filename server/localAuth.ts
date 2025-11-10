import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { validatePassword } from "./utils/password.js";
import type { SessionUser, AuthenticatedUser } from "./types/express.js";

export async function setupLocalAuth() {
  passport.use(
    "local",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          // Normalize email
          const normalizedEmail = email.toLowerCase().trim();

          // Find user by email
          const user = await storage.getUserByEmail(normalizedEmail);

          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          // Check if user has a password hash (password-based auth)
          if (!user.passwordHash) {
            return done(null, false, {
              message: "This account uses SSO login. Please use the SSO login button.",
            });
          }

          // Verify password
          const isValid = await validatePassword(password, user.passwordHash);

          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          // Update last login
          await storage.updateUser(user.id, {
            lastLoginAt: new Date(),
          });

          // Return AuthenticatedUser
          const authUser: AuthenticatedUser = {
            id: user.id,
            tenantId: user.tenantId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            authProvider: "local",
            mustChangePassword: user.mustChangePassword || false,
          };
          return done(null, authUser);
        } catch (error) {
          console.error("Error in local authentication:", error);
          return done(error);
        }
      }
    )
  );
}

export function setupPassportSerialize() {
  passport.serializeUser((user, done) => {
    const sessionUser: SessionUser = {
      id: user.id,
      tenantId: user.tenantId,
      authProvider: user.authProvider,
      // Preserve OIDC token metadata for session persistence
      ...(user.authProvider === 'oidc' && {
        claims: user.claims,
        access_token: user.access_token,
        refresh_token: user.refresh_token,
        expires_at: user.expires_at,
      }),
    };
    done(null, sessionUser);
  });

  passport.deserializeUser(async (sessionUser: SessionUser, done) => {
    try {
      const dbUser = await storage.getUser(sessionUser.id);

      if (!dbUser) {
        return done(null, false);
      }

      // Construct AuthenticatedUser based on auth provider
      const authUser: AuthenticatedUser = sessionUser.authProvider === 'local'
        ? {
            id: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            tenantId: dbUser.tenantId,
            authProvider: 'local',
            mustChangePassword: dbUser.mustChangePassword || false,
          }
        : {
            id: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            tenantId: dbUser.tenantId,
            authProvider: 'oidc',
            mustChangePassword: dbUser.mustChangePassword || false,
            // Restore OIDC token metadata from session
            claims: sessionUser.claims || { sub: dbUser.id },
            access_token: sessionUser.access_token || '',
            refresh_token: sessionUser.refresh_token,
            expires_at: sessionUser.expires_at,
          };

      done(null, authUser);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(error);
    }
  });
}
