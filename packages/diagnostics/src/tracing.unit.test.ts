import { createServer } from 'node:net';
import { once } from 'node:events';
import { beginOperation, createLogger, runInNewDiagnosticContext, runOperation, startTracing, stopTracing } from './index';

it('keeps detached attempts independent and degrades safely when export is down', async () => {
  const listener = createServer((socket) => socket.destroy());
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('test listener did not bind');
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const logger = createLogger('trace-test');
  try {
    startTracing('trace-test', logger, {
      DSAP_TRACING_ENABLED: 'true',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `http://127.0.0.1:${address.port}/v1/traces`,
    });
    const request = beginOperation(logger, 'http.request');
    await request.run(async () => {
      await Promise.all([
        runOperation(logger, 'nested', async () => 'ok'),
        runInNewDiagnosticContext(() => runOperation(logger, 'detached', async () => 'ok')),
      ]);
    });
    request.finish('aborted');
    request.finish('success');
    await stopTracing(logger);
    const records = consoleLog.mock.calls.map(([line]) => JSON.parse(line));
    const getStart = (operation: string) => records.find((record) => record.operation === operation && record.phase === 'start');
    const root = getStart('http.request');
    expect(root.traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(getStart('nested').traceId).toBe(root.traceId);
    expect(getStart('nested').spanId).not.toBe(root.spanId);
    expect(getStart('detached').traceId).not.toBe(root.traceId);
    const ends = records.filter((record) => record.operation === 'http.request' && record.phase === 'end');
    expect(ends).toMatchObject([{ outcome: 'aborted', spanId: root.spanId }]);
    expect(records.filter((record) => record.message === 'Could not export traces to Jaeger')).toHaveLength(1);
  } finally {
    await stopTracing(logger);
    consoleLog.mockRestore();
    await new Promise<void>((resolve) => listener.close(() => resolve()));
  }
});
