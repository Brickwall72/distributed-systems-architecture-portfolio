// File: packages/express/src/middleware/auth/auth.ts
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { readFileSync } from 'node:fs';
import { createPublicKey, type KeyObject } from 'node:crypto';
import { jwtVerify } from 'jose';
import {
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  AUTH_JWT_ALGORITHM,
  canAccessOrg,
  isAuditor,
  tokenClaimsSchema,
  type Role,
  type VerifiedIdentity,
} from '@contracts/auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      identity?: VerifiedIdentity;
    }
  }
}

export interface VerifyJwtOptions {
  /** PEM-encoded RSA public key (SPKI) of the auth service. */
  publicKeyPem: string;
  /** Paths (relative to where the middleware is mounted) that skip authentication, e.g. health probes. */
  publicPaths?: string[];
}

const unauthorized = (res: Response, message: string): void => {
  res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(401).json({ error: message });
};

/**
 * Verifies the Bearer access token locally against the auth service's public key.
 * The algorithm is pinned, and issuer/audience/expiry are enforced; no call to the auth service is made.
 */
export const createVerifyJwt = ({ publicKeyPem, publicPaths = [] }: VerifyJwtOptions): RequestHandler => {
  const key: KeyObject = createPublicKey(publicKeyPem);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (publicPaths.includes(req.path)) return next();

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return unauthorized(res, 'Missing bearer token');

    try {
      const { payload } = await jwtVerify(header.slice('Bearer '.length), key, {
        algorithms: [AUTH_JWT_ALGORITHM],
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      });
      const claims = tokenClaimsSchema.parse(payload);
      req.identity = { sub: claims.sub, orgId: claims.orgId, roles: claims.roles, signerId: claims.signerId };
      next();
    } catch {
      unauthorized(res, 'Invalid or expired token');
    }
  };
};

/** Requires a verified identity holding at least one of the given roles. */
export const requireRole = (...roles: Role[]): RequestHandler => (req, res, next) => {
  if (!req.identity) return unauthorized(res, 'Authentication required');
  if (!roles.some((role) => req.identity!.roles.includes(role))) {
    res.status(403).json({ error: 'Insufficient role' });
    return;
  }
  next();
};

/**
 * Returns the org filter a caller is entitled to: `undefined` means unrestricted (auditor),
 * otherwise the caller's own organization (`null` when none, so nothing matches).
 */
export const orgScope = (identity: VerifiedIdentity | undefined): string | undefined | null => {
  if (!identity) return null;
  return isAuditor(identity) ? undefined : (identity.orgId ?? null);
};

/** Guard for a specific org id (e.g. a path/body field); auditors always pass. */
export const requireOrgAccess = (getOrgId: (req: Request) => string | undefined): RequestHandler => (req, res, next) => {
  if (!req.identity) return unauthorized(res, 'Authentication required');
  const orgId = getOrgId(req);
  if (orgId !== undefined && !canAccessOrg(req.identity, orgId)) {
    res.status(403).json({ error: 'Organization access denied' });
    return;
  }
  next();
};

/** Reads the auth service's public key from a mounted file (AUTH_PUBLIC_KEY_FILE) or, for local dev, AUTH_PUBLIC_KEY. */
export const loadAuthPublicKeyPem = (env: NodeJS.ProcessEnv = process.env): string => {
  if (env.AUTH_PUBLIC_KEY_FILE) return readFileSync(env.AUTH_PUBLIC_KEY_FILE, 'utf8');
  if (env.AUTH_PUBLIC_KEY) return env.AUTH_PUBLIC_KEY.replaceAll(String.raw`\n`, '\n');
  throw new Error('AUTH_PUBLIC_KEY_FILE (or AUTH_PUBLIC_KEY for local dev) must be set');
};
