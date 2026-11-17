// File: services/core/topology-service/server/src/server.unit.test.ts
// @vitest-environment node
import express from 'express';
import type { Server } from 'node:http';

describe('topology server configuration', () => {
  it('uses the configured HTTP port and NATS URL during startup', async () => {
    vi.resetModules();
    vi.stubEnv('PORT', '0');
    vi.stubEnv('NATS_URL', 'nats://configured-broker:4333');
    vi.stubEnv('NODE_ENV', 'development');
    let rejectDatabase!: (error: Error) => void;
    const database = new Promise<never>((_resolve, reject) => { rejectDatabase = reject; });
    const credentials = { user: 'test', pass: 'test' };
    const broker = vi.fn(class {});
    vi.doMock('@shared/messaging', () => ({
      EventBroker: broker,
      natsCredentialsFromEnv: () => credentials,
    }));
    vi.doMock('./database', () => ({
      initializeDatabaseConnection: () => database,
      terminateDatabaseClient: vi.fn(),
      getDatabaseClient: vi.fn(),
      seedSpaceCustodyGraphTopology: vi.fn(),
    }));
    const listeners = vi.spyOn(process, 'on').mockImplementation(() => process);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const listen = vi.spyOn(express.application, 'listen');
    let server: Server | undefined;
    try {
      const importing = import('./server');
      await vi.waitFor(() => expect(listen).toHaveBeenCalledTimes(1), { timeout: 10000 });
      server = listen.mock.results[0]?.value;
      expect(listen).toHaveBeenCalledWith(0, '0.0.0.0', expect.any(Function));
      expect(broker).toHaveBeenCalledWith('nats://configured-broker:4333', expect.anything(), credentials);
      if (!server) throw new Error('HTTP server was not started');
      if (!server.listening) await new Promise<void>((resolve) => server!.once('listening', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('HTTP server did not bind a TCP port');
      expect((await fetch(`http://127.0.0.1:${address.port}/live`)).status).toBe(200);
      rejectDatabase(new Error('database startup interrupted'));
      await importing;
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      if (server?.listening) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
      listen.mockRestore();
      listeners.mockRestore();
      exit.mockRestore();
      vi.doUnmock('@shared/messaging');
      vi.doUnmock('./database');
      vi.unstubAllEnvs();
    }
  }, 15000);
});
