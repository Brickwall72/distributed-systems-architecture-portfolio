// File: services/core/compliance-service/server/src/server.unit.test.ts
// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';

describe('compliance server startup', () => {
  it('opens liveness before dependencies are ready without exposing readiness', async () => {
    vi.resetModules();
    let rejectDatabase!: (error: Error) => void;
    const database = new Promise<never>((_resolve, reject) => { rejectDatabase = reject; });
    vi.doMock('./config', () => ({
      env: {
        NODE_ENV: 'development', PORT: 0, NATS_URL: 'nats://localhost:4222',
        S3_PUBLIC_ENDPOINT: 'http://localhost:9000', S3_REGION: 'us-east-1',
        S3_ACCESS_KEY: 'test', S3_SECRET_KEY: 'test', DOCUMENT_BUCKET: 'dsap',
      },
    }));
    vi.doMock('./db', () => ({
      initializeDatabaseWithRetry: () => database,
      pool: { end: vi.fn() },
    }));
    vi.stubEnv('NATS_USER', 'compliance');
    vi.stubEnv('NATS_PASSWORD', 'test');
    const listeners = vi.spyOn(process, 'on').mockImplementation(() => process);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const listen = vi.spyOn(express.application, 'listen');
    let server: Server | undefined;
    try {
      const importing = import('./server');
      await vi.waitFor(() => expect(listen).toHaveBeenCalledTimes(1), { timeout: 10000 });
      server = listen.mock.results[0]?.value;
      expect(server).toBeDefined();
      if (!server) throw new Error('HTTP server was not started');
      if (!server.listening) await new Promise<void>((resolve) => server!.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('HTTP server did not bind a TCP port');
      expect((await fetch(`http://127.0.0.1:${address.port}/live`)).status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${address.port}/api/v1/health`)).ok).toBe(false);
      const shutdown = listeners.mock.calls.find(([event]) => event === 'SIGTERM')?.[1];
      expect(shutdown).toBeDefined();
      shutdown?.();
      rejectDatabase(new Error('database startup interrupted'));
      await importing;
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
      expect(listen).toHaveBeenCalledTimes(1);
    } finally {
      if (server?.listening) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
      listen.mockRestore();
      listeners.mockRestore();
      exit.mockRestore();
      vi.unstubAllEnvs();
      vi.doUnmock('./config');
      vi.doUnmock('./db');
    }
  }, 15000);
});
