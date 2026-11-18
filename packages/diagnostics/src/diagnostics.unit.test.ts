// File: packages/diagnostics/src/diagnostics.unit.test.ts
import {
  beginOperation, createLogger, diagnosticId, getDiagnosticContext, runInNewDiagnosticContext,
  runOperation, runWithDiagnosticContext, withoutDiagnosticContext,
} from './index';

afterEach(() => vi.restoreAllMocks());

describe('diagnostic context and operations', () => {
  it('isolates interleaved async work and restores parent context after failure', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('test');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const failure = new Error('private payload');
    await Promise.all([
      runInNewDiagnosticContext(async () => {
        await gate;
        const outer = getDiagnosticContext();
        await expect(runOperation(logger, 'nested', async () => { throw failure; })).rejects.toBe(failure);
        expect(getDiagnosticContext()).toBe(outer);
        logger.info('first');
      }, 'first'),
      runInNewDiagnosticContext(async () => {
        logger.info('second');
        release();
        await gate;
        expect(getDiagnosticContext()?.correlationId).toBe('second');
      }, 'second'),
    ]);
    expect(getDiagnosticContext()).toBeUndefined();
    const records = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(records.find((record) => record.message === 'first').correlationId).toBe('first');
    expect(records.filter((record) => record.operation === 'nested')).toHaveLength(2);
    expect(JSON.stringify(records)).not.toContain('private payload');
  });

  it('records nested parentage and explicit domain outcomes without false success', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('test');
    await runInNewDiagnosticContext(() => runOperation(logger, 'outer', async () =>
      runOperation(logger, 'inner', async () => 'pending', { classify: () => 'deferred' }),
    { classify: () => 'rejected' }), 'request');
    const records = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(records).toHaveLength(4);
    expect(records[1].parentOperationId).toBe(records[0].operationId);
    expect(records[2]).toMatchObject({ outcome: 'deferred', level: 'WARN' });
    expect(records[3]).toMatchObject({ outcome: 'rejected', level: 'WARN' });
    expect(records[3].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('supports inherited, explicit, null and outside-context legacy log IDs', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('test');
    logger.info('outside');
    runWithDiagnosticContext({ correlationId: 'inherited' }, () => {
      logger.info('inherited');
      logger.warn('override', 'explicit');
      logger.error('opt-out', null);
      withoutDiagnosticContext(() => logger.info('detached'));
      expect(getDiagnosticContext()?.correlationId).toBe('inherited');
    });
    expect(log.mock.calls.map(([line]) => JSON.parse(line).correlationId))
      .toEqual([null, 'inherited', 'explicit', null, null]);
    expect(diagnosticId('bad,value')).not.toBe('bad,value');
    expect(diagnosticId('id\n')).not.toBe('id\n');
  });

  it('deduplicates operation terminal callbacks and retains failed quiet operations', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('test');
    const probe = beginOperation(logger, 'probe', {}, true);
    probe.finish('success');
    probe.finish('aborted');
    expect(log).not.toHaveBeenCalled();
    const failed = beginOperation(logger, 'probe', {}, true);
    failed.finish('failure');
    failed.finish('success');
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ phase: 'end', outcome: 'failure', level: 'ERROR' });
  });

  it('only serializes allowlisted metadata even when a structural superset is supplied', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const metadata = { documentId: 'document-1', password: 'private-token', nested: { html: 'private HTML' } };
    createLogger('test').info('metadata', undefined, metadata);
    const record = JSON.parse(log.mock.calls[0][0]);
    expect(record.documentId).toBe('document-1');
    expect(record).not.toHaveProperty('password');
    expect(record).not.toHaveProperty('nested');
  });
});
