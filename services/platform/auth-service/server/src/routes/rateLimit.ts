// File: services/platform/auth-service/server/src/routes/rateLimit.ts
import type { RequestHandler } from 'express';

/** Fixed-window per-IP limiter; sufficient for a single-replica dev-login endpoint. */
export const createRateLimit = (maxPerMinute: number): RequestHandler => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxPerMinute) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
};
