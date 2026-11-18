// File: packages/messaging/src/diagnostics.integration.test.ts
// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import {
  createLogger,
  createRequestDiagnostics,
  getDiagnosticContext,
  runOperation,
  startTracing,
  stopTracing,
  type DiagnosticContext,
} from '@shared/express';
import { EventBroker } from './index.js';

const natsUrl = process.env.MESSAGING_DIAGNOSTICS_TEST_NATS_URL;
const traceEndpoint = process.env.MESSAGING_DIAGNOSTICS_TEST_OTLP_URL;
const jaegerUrl = process.env.MESSAGING_DIAGNOSTICS_TEST_JAEGER_URL;
const integration = natsUrl ? describe : describe.skip;

integration('NATS diagnostic propagation', () => {
  it('carries an HTTP middleware context through the broker and responder', async () => {
    const subject = `integration.diagnostics.${randomUUID().replaceAll('-', '')}`;
    const logger = createLogger('messaging-diagnostics-integration');
    if (traceEndpoint) startTracing('messaging-diagnostics-integration', logger, {
      DSAP_TRACING_ENABLED: 'true', OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: traceEndpoint,
    });
    const requester = new EventBroker(natsUrl!, logger);
    const responder = new EventBroker(natsUrl!, logger);
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (line?: unknown) => { logs.push(String(line)); };
    let deliveryContext!: DiagnosticContext;
    let server: Server | undefined;

    try {
      await Promise.all([requester.connect(), responder.connect()]);
      responder.respond(subject, async (payload) => {
        deliveryContext = getDiagnosticContext()!;
        return runOperation(logger, 'integration.timed', async () => {
          await delay(35);
          return payload;
        });
      });
      await responder.flush();

      const app = createExpressApp();
      app.use(createRequestDiagnostics(logger));
      app.get('/health', (_request: unknown, response: any) => response.sendStatus(200));
      app.get('/rpc', async (_request: unknown, response: any) => {
        response.json(await requester.request(subject, { value: 'preserved' }));
      });
      const httpServer: Server = app.listen(0, '127.0.0.1');
      server = httpServer;
      await new Promise<void>((resolve) => httpServer.once('listening', resolve));
      const address = httpServer.address();
      if (!address || typeof address === 'string') throw new Error('HTTP integration server did not bind a TCP port');

      const requestPayload = { value: 'preserved' };
      await fetch(`http://127.0.0.1:${address.port}/health`);
      const response = await fetch(`http://127.0.0.1:${address.port}/rpc`, {
        headers: {
          'x-correlation-id': 'integration-http-correlation',
          traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('x-correlation-id')).toBe('integration-http-correlation');
      expect(await response.json()).toEqual(requestPayload);
      expect(deliveryContext.correlationId).toBe('integration-http-correlation');
      expect(deliveryContext.parentOperationId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
      const entries = logs.map((line) => JSON.parse(line));
      const httpOperation = entries.find((entry) => entry.operation === 'http.request' && entry.phase === 'start');
      const requestOperation = entries.find((entry) => entry.operation === 'nats.request' && entry.phase === 'start');
      const responderOperation = entries.find((entry) => entry.operation === 'nats.responder' && entry.phase === 'start');
      expect(httpOperation.correlationId).toBe('integration-http-correlation');
      expect(requestOperation.correlationId).toBe('integration-http-correlation');
      expect(requestOperation.parentOperationId).toBe(httpOperation.operationId);
      expect(responderOperation.correlationId).toBe('integration-http-correlation');
      expect(responderOperation.parentOperationId).toBe(requestOperation.operationId);
      expect(deliveryContext.parentOperationId).toBe(requestOperation.operationId);
      if (traceEndpoint) {
        expect(httpOperation.traceId).toMatch(/^[a-f0-9]{32}$/);
        expect(httpOperation.traceId).not.toBe('11111111111111111111111111111111');
        expect(requestOperation.traceId).toBe(httpOperation.traceId);
        expect(responderOperation.traceId).toBe(httpOperation.traceId);
        const httpEnd = entries.find((entry) => entry.operation === 'http.request' && entry.phase === 'end');
        expect(httpEnd.spanId).toBe(httpOperation.spanId);
      }
      if (jaegerUrl) {
        await stopTracing(logger);
        await expect.poll(async () => {
          const query = await fetch(`${jaegerUrl}/api/traces/${httpOperation.traceId}`);
          if (!query.ok) return [];
          const result = await query.json();
          return result.data[0]?.spans ?? [];
        }, { timeout: 5000 }).toEqual(expect.arrayContaining([
          expect.objectContaining({ spanID: httpOperation.spanId, operationName: 'GET /rpc', references: [] }),
          expect.objectContaining({ spanID: requestOperation.spanId, references: [
            expect.objectContaining({ refType: 'CHILD_OF', spanID: httpOperation.spanId }),
          ] }),
          expect.objectContaining({ spanID: responderOperation.spanId, references: [
            expect.objectContaining({ refType: 'CHILD_OF', spanID: requestOperation.spanId }),
          ] }),
          expect.objectContaining({ operationName: 'integration.timed', references: [
            expect.objectContaining({ refType: 'CHILD_OF', spanID: responderOperation.spanId }),
          ] }),
        ]));
        const query = await fetch(`${jaegerUrl}/api/traces/${httpOperation.traceId}`);
        const result = await query.json();
        const spans: Array<{ operationName: string; duration: number }> = result.data[0].spans;
        expect(spans).toHaveLength(4);
        expect(spans.find((span) => span.operationName === 'integration.timed')?.duration).toBeGreaterThanOrEqual(34_000);
      }
    } finally {
      await stopTracing(logger);
      console.log = originalLog;
      await Promise.all([
        server ? new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())) : Promise.resolve(),
        requester.disconnect(),
        responder.disconnect(),
      ]);
    }
  }, 10000);
});

function createExpressApp() {
  const requireFromExpressFacade = createRequire(import.meta.resolve('@shared/express'));
  const express = requireFromExpressFacade('express');
  return express();
}
