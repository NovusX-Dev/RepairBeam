import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

const stores: { [storeName: string]: RateLimitStore } = {};

function getStore(storeName: string): RateLimitStore {
  if (!stores[storeName]) {
    stores[storeName] = {};
  }
  return stores[storeName];
}

function cleanupStore(store: RateLimitStore): void {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}

setInterval(() => {
  for (const storeName in stores) {
    cleanupStore(stores[storeName]);
  }
}, 60000);

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  storeName?: string;
  keyGenerator?: (req: Request) => string;
  message?: string;
  skipFailedRequests?: boolean;
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    storeName = 'default',
    keyGenerator = (req: Request) => req.ip || req.socket?.remoteAddress || 'unknown',
    message = 'Too many requests, please try again later',
    skipFailedRequests = false
  } = options;

  const store = getStore(storeName);

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs
      };
    } else {
      store[key].count++;
    }

    const remaining = Math.max(0, maxRequests - store[key].count);
    const resetTime = Math.ceil((store[key].resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toString());

    if (store[key].count > maxRequests) {
      res.setHeader('Retry-After', resetTime.toString());
      return res.status(429).json({ 
        message,
        retryAfter: resetTime
      });
    }

    if (skipFailedRequests) {
      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
        if (res.statusCode >= 400) {
          store[key].count = Math.max(0, store[key].count - 1);
        }
        return originalEnd(chunk, encoding as BufferEncoding, cb);
      } as typeof res.end;
    }

    next();
  };
}

export function createPhoneRateLimiter(options: Omit<RateLimitOptions, 'keyGenerator'>) {
  return rateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      const phone = req.body?.clientPhone || req.body?.phone || 'unknown';
      return `phone:${phone}`;
    }
  });
}

export function createTenantRateLimiter(options: Omit<RateLimitOptions, 'keyGenerator'>) {
  return rateLimit({
    ...options,
    keyGenerator: (req: any) => {
      const tenantId = req.authUser?.tenantId || 'unknown';
      return `tenant:${tenantId}`;
    }
  });
}

export function createTokenRateLimiter(options: Omit<RateLimitOptions, 'keyGenerator'>) {
  return rateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      const token = req.params?.token || 'unknown';
      return `token:${token}`;
    }
  });
}

export function createCompositeRateLimiter(
  ipOptions: RateLimitOptions,
  secondaryOptions?: RateLimitOptions
) {
  const ipLimiter = rateLimit(ipOptions);
  const secondaryLimiter = secondaryOptions ? rateLimit(secondaryOptions) : null;

  return (req: Request, res: Response, next: NextFunction) => {
    ipLimiter(req, res, (err?: any) => {
      if (err || res.headersSent) return;
      if (secondaryLimiter) {
        secondaryLimiter(req, res, next);
      } else {
        next();
      }
    });
  };
}
