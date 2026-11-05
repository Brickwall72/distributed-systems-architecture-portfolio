// File: packages/express/src/middleware/auth/auth.unit.test.ts
import express from 'express';
import request from 'supertest';
import { createTestAuth } from '@shared/testing';
import { ROLE } from '@contracts/auth';
import { createVerifyJwt, requireRole } from './auth';

const auth = createTestAuth();
const other = createTestAuth();

const buildApp = () => {
  const app = express();
  app.use(createVerifyJwt({ publicKeyPem: auth.publicKeyPem, publicPaths: ['/health'] }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/me', (req, res) => res.json(req.identity));
  app.get('/admin', requireRole(ROLE.AUDITOR), (_req, res) => res.json({ ok: true }));
  return app;
};

describe('createVerifyJwt', () => {
  it('lets public paths through without a token', async () => {
    await request(buildApp()).get('/health').expect(200);
  });

  it('rejects requests without a token', async () => {
    await request(buildApp()).get('/me').expect(401);
  });

  it('attaches the verified identity', async () => {
    const res = await request(buildApp()).get('/me').set(await auth.authHeader({ orgId: 'org-a' })).expect(200);
    expect(res.body).toMatchObject({ orgId: 'org-a', roles: [ROLE.ORG_MEMBER] });
  });

  it('rejects tokens signed by another key', async () => {
    await request(buildApp()).get('/me').set(await other.authHeader()).expect(401);
  });

  it('rejects expired tokens', async () => {
    const token = await auth.signToken({}, { expiresIn: '-1m' });
    await request(buildApp()).get('/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('rejects the alg=none forgery', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'x', orgId: null, roles: ['auditor'], signerId: 'x' })}.`;
    await request(buildApp()).get('/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });
});

describe('requireRole', () => {
  it('forbids callers without the role', async () => {
    await request(buildApp()).get('/admin').set(await auth.authHeader()).expect(403);
  });

  it('allows callers with the role', async () => {
    await request(buildApp()).get('/admin').set(await auth.authHeader({ roles: [ROLE.AUDITOR], orgId: null })).expect(200);
  });
});
