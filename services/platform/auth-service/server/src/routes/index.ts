// File: services/platform/auth-service/server/src/routes/index.ts
import { Router } from 'express';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { createHealthCheck, createVerifyJwt } from '@shared/express';
import { authContract, SIGNATURE_PATH } from 'auth-shared';
import { IDENTITIES, findIdentity, signatureSvg } from '../identities/identities';
import type { TokenService } from '../services/token.service';
import { createRateLimit } from './rateLimit';

export interface AuthGatewayDeps {
  tokenService: TokenService;
  publicKeyPem: string;
  devLoginEnabled: boolean;
  sessionRateLimit: number;
}

export function createAuthGateway({ tokenService, publicKeyPem, devLoginEnabled, sessionRateLimit }: AuthGatewayDeps): Router {
  const router = Router();
  router.get('/health', createHealthCheck('auth-server'));

  router.post('/session', createRateLimit(sessionRateLimit));
  router.get(SIGNATURE_PATH, createVerifyJwt({ publicKeyPem }), (req, res) => {
    // The identity comes from the verified token, so a caller can only ever fetch its own signature.
    const identity = req.identity && findIdentity(req.identity.sub);
    if (!identity) {
      res.status(404).json({ error: 'Signature not found' });
      return;
    }
    res.type('image/svg+xml').send(signatureSvg(identity));
  });

  const s = initServer();
  const handlers = s.router(authContract, {
    getIdentities: () => Promise.resolve({ status: 200 as const, body: devLoginEnabled ? [...IDENTITIES] : [] }),

    createSession: async ({ body }) => {
      if (!devLoginEnabled) return { status: 403, body: { error: 'Dev login is disabled' } };
      const identity = findIdentity(body.identityId);
      if (!identity) return { status: 404, body: { error: 'Unknown identity' } };
      return { status: 200, body: { ...(await tokenService.issue(identity)), identity } };
    },
  });

  createExpressEndpoints(authContract, handlers, router, { responseValidation: false });
  return router;
}
