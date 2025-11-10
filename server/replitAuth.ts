import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { setupLocalAuth, setupPassportSerialize } from "./localAuth.js";
import type { AuthenticatedUser } from "./types/express.js";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Check if user exists
  let user = await storage.getUser(claims["sub"]);
  
  if (!user) {
    // Create a default tenant for new users or get existing one
    let tenant = await storage.getTenantByDomain('default');
    if (!tenant) {
      tenant = await storage.createTenant({
        domain: 'default',
        settings: {}
      });

      // Initialize default defects and checklists for the new tenant
      await storage.initializeDefaultDefects(tenant.id);
      await storage.initializeDefaultChecklists(tenant.id);
    }

    // Create user with tenant
    user = await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
      tenantId: tenant.id,
      role: 'user'
    });

    // Only create Admin group and assign to user if this is a brand new tenant (first user)
    // Check if tenant was just created by checking if there are any other users
    const tenantUsers = await storage.getUsersByTenant(tenant.id);
    if (tenantUsers.length === 1) { // Only the newly created user exists
      await storage.ensureAdminGroup(tenant.id, user.id);
      await storage.seedPermissionTemplates(tenant.id);
    }
  } else {
    // Update existing user info (without changing tenantId)
    user = await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
      tenantId: user.tenantId,
      role: user.role || 'user'
    });
  }
  
  return user;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup Local Strategy for password-based auth
  await setupLocalAuth();

  // Setup shared serialization/deserialization for both OIDC and Local
  setupPassportSerialize();

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const tokenClaims = tokens.claims();
    
    // Guard against missing claims
    if (!tokenClaims || !tokenClaims.sub) {
      console.error('OIDC authentication failed: missing claims');
      return verified(new Error('Invalid token claims'), false);
    }
    
    const dbUser = await upsertUser(tokenClaims);
    
    // Build OidcAuthenticatedUser for OIDC
    const authUser: AuthenticatedUser = {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      tenantId: dbUser.tenantId,
      authProvider: 'oidc',
      mustChangePassword: dbUser.mustChangePassword || false,
      claims: {
        sub: String(tokenClaims.sub),
        email: tokenClaims.email ? String(tokenClaims.email) : undefined,
        first_name: tokenClaims.first_name ? String(tokenClaims.first_name) : undefined,
        last_name: tokenClaims.last_name ? String(tokenClaims.last_name) : undefined,
        profile_image_url: tokenClaims.profile_image_url ? String(tokenClaims.profile_image_url) : undefined,
        exp: tokenClaims.exp ? Number(tokenClaims.exp) : undefined,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokenClaims.exp ? Number(tokenClaims.exp) : undefined,
    };
    
    verified(null, authUser);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user;

  // Local auth users don't need token refresh
  if (user.authProvider === 'local') {
    return next();
  }

  // OIDC auth users need token refresh handling
  if (!user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user as any, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
