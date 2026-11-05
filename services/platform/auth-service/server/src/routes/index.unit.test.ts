// File: services/platform/auth-service/server/src/routes/index.unit.test.ts
import express from 'express';
import request from 'supertest';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { createVerifyJwt } from '@shared/express';
import { createAuthGateway } from './index';
import { TokenService } from '../services/token.service';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();

const buildApp = async (overrides: { devLoginEnabled?: boolean; sessionRateLimit?: number } = {}) => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1',
    createAuthGateway({
      tokenService: await TokenService.create(privateKey, 900),
      publicKeyPem,
      devLoginEnabled: true,
      sessionRateLimit: 20,
      ...overrides,
    }),
  );
  return app;
};

describe('auth gateway', () => {
  it('lists identities when dev login is enabled', async () => {
    const res = await request(await buildApp()).get('/api/v1/identities').expect(200);
    expect(res.body.length).toBeGreaterThan(1);
    expect(res.body[0]).not.toHaveProperty('signature');
  });

  it('mints a token that the shared middleware accepts', async () => {
    const app = await buildApp();
    const { body } = await request(app).post('/api/v1/session').send({ identityId: 'usr_ksc_gov' }).expect(200);

    const verifier = express();
    verifier.use(createVerifyJwt({ publicKeyPem }));
    verifier.get('/me', (req, res) => res.json(req.identity));
    const me = await request(verifier).get('/me').set('Authorization', `Bearer ${body.accessToken}`).expect(200);
    expect(me.body).toMatchObject({ sub: 'usr_ksc_gov' });
  });

  it('returns 404 for unknown identities', async () => {
    await request(await buildApp()).post('/api/v1/session').send({ identityId: 'nope' }).expect(404);
  });

  it('refuses to mint when dev login is disabled', async () => {
    await request(await buildApp({ devLoginEnabled: false })).post('/api/v1/session').send({ identityId: 'usr_ksc_gov' }).expect(403);
  });

  it('rate limits /session', async () => {
    const app = await buildApp({ sessionRateLimit: 2 });
    for (let i = 0; i < 2; i++) await request(app).post('/api/v1/session').send({ identityId: 'usr_ksc_gov' }).expect(200);
    await request(app).post('/api/v1/session').send({ identityId: 'usr_ksc_gov' }).expect(429);
  });

  it('serves a signature only to the authenticated identity', async () => {
    const app = await buildApp();
    await request(app).get('/api/v1/identities/me/signature').expect(401);
    const { body } = await request(app).post('/api/v1/session').send({ identityId: 'usr_auditor' }).expect(200);
    const res = await request(app).get('/api/v1/identities/me/signature').set('Authorization', `Bearer ${body.accessToken}`).expect(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect(res.body.toString()).toContain('Platform Auditor'); // the token's identity, not a caller-chosen one
  });
});
