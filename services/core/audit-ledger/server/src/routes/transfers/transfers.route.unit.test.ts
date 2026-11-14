// File: services/core/audit-ledger/server/src/routes/transfers/transfers.route.unit.test.ts
import express, { type Request } from 'express';
import request from 'supertest';
import { createAuditGateway } from '../index';
import { LedgerService } from '../../services';
import { LEDGER_STATUS } from 'audit-shared';

const auditor: NonNullable<Request['identity']> = { sub: 'auditor', orgId: null, roles: ['auditor'], signerId: 'auditor' };
const member: NonNullable<Request['identity']> = { sub: 'member', orgId: 'org-a', roles: ['org-member'], signerId: 'member' };

function appWith(overrides: Partial<Record<keyof LedgerService, unknown>>, identity: Request['identity'] | null = auditor) {
  const service = Object.assign(Object.create(LedgerService.prototype), overrides) as LedgerService;
  const app = express();
  app.use((req, _res, next) => {
    req.identity = identity ?? undefined;
    next();
  });
  app.use('/api/v1', createAuditGateway({ ledgerService: service }));
  return app;
}

describe('audit gateway routes', () => {
  it('serves health', async () => {
    const res = await request(appWith({})).get('/api/v1/health');
    expect(res.status).toBe(200);
  });

  it('returns 404 for an unknown sealed record', async () => {
    const res = await request(appWith({ getSealedTransfer: vi.fn().mockResolvedValue(null) })).get('/api/v1/transfers/REQ-X');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 500 with the error contract when the service fails', async () => {
    const res = await request(appWith({ listTransfers: vi.fn().mockRejectedValue(new Error('boom')) })).get('/api/v1/transfers');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('applies query defaults on the list endpoint', async () => {
    const listTransfers = vi.fn().mockResolvedValue([]);
    const res = await request(appWith({ listTransfers })).get('/api/v1/transfers?status=OPEN');
    expect(res.status).toBe(200);
    expect(listTransfers).toHaveBeenCalledWith({ status: LEDGER_STATUS.OPEN, limit: 50, offset: 0 }, { kind: 'auditor' });
  });

  it('exposes no write endpoints', async () => {
    const res = await request(appWith({})).post('/api/v1/transfers').send({});
    expect(res.status).toBe(404);
  });

  it('verifies the ledger', async () => {
    const result = { valid: true, checked: 0, failures: [] };
    const res = await request(appWith({ verifyLedger: vi.fn().mockResolvedValue(result) })).get('/api/v1/ledger/verify');
    expect(res.body).toEqual(result);
  });

  it.each([
    [{ status: 'NOT_FOUND' }, 404],
    [{ status: 'NOT_READY' }, 409],
    [{ status: 'READY', presignedUrl: 'https://storage.example/file.pdf' }, 200],
  ])('returns the document state without caching', async (result, status) => {
    const getTransferDocument = vi.fn().mockResolvedValue(result);
    const res = await request(appWith({ getTransferDocument })).get('/api/v1/transfers/REQ-X/document');
    expect(res.status).toBe(status);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(getTransferDocument).toHaveBeenCalledWith('REQ-X', { kind: 'auditor' });
    if (status === 200) expect(res.body).toEqual({ presignedUrl: 'https://storage.example/file.pdf' });
  });

  it('does not expose signing failures and prevents caching them', async () => {
    const res = await request(appWith({
      getTransferDocument: vi.fn().mockRejectedValue(new Error('secret URL')),
    })).get('/api/v1/transfers/REQ-X/document');
    expect(res.status).toBe(500);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(res.body)).not.toContain('secret URL');
  });

  it('scopes members and denies administrative endpoints', async () => {
    const listTransfers = vi.fn().mockResolvedValue([]);
    const app = appWith({ listTransfers }, member);
    await request(app).get('/api/v1/transfers').expect(200);
    expect(listTransfers).toHaveBeenCalledWith(expect.anything(), { kind: 'organization', orgId: 'org-a' });
    await request(app).get('/api/v1/ledger/verify').expect(403);
    await request(app).get('/api/v1/dead-letters').expect(403);
  });

  it('rejects missing identities and members without an organization', async () => {
    await request(appWith({}, null)).get('/api/v1/transfers').expect(401);
    await request(appWith({}, { ...member, orgId: null })).get('/api/v1/transfers').expect(403);
  });
});
