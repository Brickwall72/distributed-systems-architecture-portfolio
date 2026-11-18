// File: packages/messaging/src/diagnostics.integration.test.ts
// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { Server } from 'node:http';
import {
  createLogger,
  createRequestDiagnostics,
  getDiagnosticContext,
  type DiagnosticContext,
} from '@shared/express';
import { EventBroker } from './index.js';

const natsUrl = process.env.MESSAGING_DIAGNOSTICS_TEST_NATS_URL;
const integration = natsUrl ? describe : describe.skip;

integration('NATS diagnostic propagation', () => {
  it('carries an HTTP middleware context through the broker and responder', async () => {
    const subject = `integration.diagnostics.${randomUUID().replaceAll('-', '')}`;
    const logger = createLogger('messaging-diagnostics-integration');
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
        return payload;
      });
      await responder.flush();

      const app = createExpressApp();
      app.use(createRequestDiagnostics(logger));
      app.get('/rpc', async (_request: unknown, response: any) => {
        response.json(await requester.request(subject, { value: 'preserved' }));
      });
      const httpServer: Server = app.listen(0, '127.0.0.1');
      server = httpServer;
      await new Promise<void>((resolve) => httpServer.once('listening', resolve));
      const address = httpServer.address();
      if (!address || typeof address === 'string') throw new Error('HTTP integration server did not bind a TCP port');

      const requestPayload = { value: 'preserved' };
      const response = await fetch(`http://127.0.0.1:${address.port}/rpc`, {
        headers: { 'x-correlation-id': 'integration-http-correlation' },
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
    } finally {
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
