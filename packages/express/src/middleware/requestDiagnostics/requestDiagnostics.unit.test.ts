// File: packages/express/src/middleware/requestDiagnostics/requestDiagnostics.unit.test.ts
import express from 'express';
import http from 'node:http';
import request from 'supertest';
import { createLogger, getDiagnosticContext } from '../../telemetry';
import { createErrorHandler } from '../errorHandler';
import { createRequestDiagnostics } from './requestDiagnostics';

describe('request diagnostics middleware', () => {
  let app: express.Express;
  let output: string[];

  beforeEach(() => {
    output = [];
    vi.spyOn(console, 'log').mockImplementation((line?: unknown) => {
      output.push(String(line));
    });
    app = express();
    const logger = createLogger('http-test');
    app.use(createRequestDiagnostics(logger));
    app.use(express.json());
    app.get('/live', (_req, res) => res.sendStatus(200));
    app.get('/api/v1/health', (_req, res) => res.sendStatus(503));
    app.get('/context', (_req, res) => {
      res.json({ id: getDiagnosticContext()?.correlationId });
    });
    app.get('/delay/:ms', (req, res) => {
      setTimeout(() => {
        logger.info('Delayed route completed');
        res.json({ id: getDiagnosticContext()?.correlationId });
      }, Number(req.params.ms));
    });
    app.get('/slow', (_req, res) => {
      setTimeout(() => res.end('late'), 100);
    });
    app.post('/body', (_req, res) => res.sendStatus(204));
    app.get('/error', (_req, _res, next) => next(new Error('private error fixture')));
    app.use(createErrorHandler(createLogger('http-test')));
  });

  afterEach(() => vi.restoreAllMocks());

  const parsedLogs = () => output.map((line) => JSON.parse(line) as Record<string, unknown>);

  it('generates a canonical ID before parsing and returns it on parser errors', async () => {
    const response = await request(app).post('/body').set('content-type', 'application/json').send('{');

    expect(response.status).toBe(400);
    expect(response.headers['x-correlation-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(parsedLogs().some((log) => log.correlationId === response.headers['x-correlation-id'])).toBe(true);
  });

  it('preserves one valid canonical ID and uses the request ID only when canonical is absent', async () => {
    const canonical = await request(app).get('/context')
      .set('x-correlation-id', 'canonical-1').set('x-request-id', 'fallback-1');
    expect(canonical.headers['x-correlation-id']).toBe('canonical-1');
    expect(canonical.body.id).toBe('canonical-1');

    const fallback = await request(app).get('/context').set('x-request-id', 'fallback-2');
    expect(fallback.headers['x-correlation-id']).toBe('fallback-2');
    expect(fallback.body.id).toBe('fallback-2');
  });

  it('replaces invalid canonical, duplicate, and oversized values without falling back', async () => {
    const invalid = await request(app).get('/context')
      .set('x-correlation-id', 'bad value').set('x-request-id', 'valid-fallback');
    expect(invalid.headers['x-correlation-id']).not.toBe('valid-fallback');
    expect(invalid.body.id).toBe(invalid.headers['x-correlation-id']);

    const commaJoined = await request(app).get('/context').set('x-correlation-id', 'first,second');
    expect(commaJoined.headers['x-correlation-id']).not.toBe('first,second');

    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
      const duplicateId = await new Promise<string>((resolve, reject) => {
        const duplicateRequest = http.request({
          hostname: '127.0.0.1',
          port: address.port,
          path: '/context',
          headers: { 'x-correlation-id': ['first', 'second'] },
        }, (response) => {
          const value = response.headers['x-correlation-id'];
          if (typeof value !== 'string') {
            reject(new Error('Missing canonical correlation ID response header'));
            return;
          }
          response.resume();
          response.once('end', () => resolve(value));
        });
        duplicateRequest.once('error', reject);
        duplicateRequest.end();
      });
      expect(duplicateId).not.toBe('first');
      expect(duplicateId).not.toBe('second');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }

    const oversized = await request(app).get('/context').set('x-correlation-id', 'x'.repeat(129));
    expect(oversized.headers['x-correlation-id']).not.toBe('x'.repeat(129));

    const invalidFallback = await request(app).get('/context').set('x-request-id', 'invalid fallback');
    expect(invalidFallback.headers['x-correlation-id']).not.toBe('invalid fallback');
    expect(parsedLogs().filter((log) => log.message === 'Invalid diagnostic correlation ID replaced')).toHaveLength(5);
  });

  it('keeps successful exact health probes quiet but logs failed probes and unmatched requests', async () => {
    await request(app).get('/live').expect(200);
    expect(parsedLogs()).toHaveLength(0);

    await request(app).get('/api/v1/health').expect(503);
    await request(app).get('/missing?private=value').expect(404);
    const logs = parsedLogs();
    expect(logs.some((log) => log.outcome === 'failure' && log.statusCode === 503)).toBe(true);
    expect(logs.some((log) => log.route === 'unmatched')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('private=value');
  });

  it('keeps concurrent request contexts isolated across async callbacks', async () => {
    const [first, second] = await Promise.all([
      request(app).get('/delay/20').set('x-correlation-id', 'request-first'),
      request(app).get('/delay/5').set('x-correlation-id', 'request-second'),
    ]);

    expect(first.body.id).toBe('request-first');
    expect(second.body.id).toBe('request-second');
    const routeLogs = parsedLogs().filter((log) => log.message === 'Delayed route completed');
    expect(routeLogs).toEqual(expect.arrayContaining([
      expect.objectContaining({ correlationId: 'request-first' }),
      expect.objectContaining({ correlationId: 'request-second' }),
    ]));
  });

  it('logs a premature close as aborted and does not also report success', async () => {
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
      const aborted = new Promise<void>((resolve) => {
        const client = http.request({
          hostname: '127.0.0.1',
          port: address.port,
          path: '/slow',
          headers: { 'x-correlation-id': 'aborted-request' },
        });
        client.once('error', () => resolve());
        client.end();
        setTimeout(() => client.destroy(), 10);
      });
      await aborted;
      await new Promise((resolve) => setTimeout(resolve, 120));

      const logs = parsedLogs().filter((log) => log.correlationId === 'aborted-request');
      expect(logs).toEqual(expect.arrayContaining([
        expect.objectContaining({ phase: 'end', outcome: 'aborted' }),
      ]));
      expect(logs).not.toContainEqual(expect.objectContaining({ phase: 'end', outcome: 'success' }));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('uses the active context and does not log arbitrary thrown error messages', async () => {
    const response = await request(app).get('/error').set('x-correlation-id', 'error-context');
    expect(response.status).toBe(500);
    expect(response.headers['x-correlation-id']).toBe('error-context');
    const logs = parsedLogs();
    expect(logs.some((log) => log.correlationId === 'error-context')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('private error fixture');
  });
});
