// File: packages/diagnostics/src/operation.ts
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { diagnosticId, getDiagnosticContext, runWithDiagnosticContext } from './context';
import { safeErrorMetadata, type DiagnosticMetadata, type Logger, type OperationOutcome } from './logger';

export function beginOperation(
  logger: Logger,
  operation: string,
  metadata: DiagnosticMetadata = {},
  quiet = false,
) {
  const parent = getDiagnosticContext();
  const context = {
    correlationId: parent?.correlationId ?? diagnosticId(),
    operation,
    operationId: randomUUID(),
    parentOperationId: parent?.operationId,
  };
  const start = performance.now();
  let ended = false;
  if (!quiet) {
    runWithDiagnosticContext(context, () => logger.info(`Starting ${operation}`, undefined, { ...metadata, phase: 'start' }));
  }
  return {
    context,
    finish(outcome: OperationOutcome, details: DiagnosticMetadata = {}) {
      if (ended) return;
      ended = true;
      if (quiet && outcome === 'success') return;
      let method: 'error' | 'warn' | 'info' = 'info';
      if (outcome === 'failure') {
        method = 'error';
      } else if (['rejected', 'deferred', 'aborted', 'discarded'].includes(outcome)) {
        method = 'warn';
      }
      runWithDiagnosticContext(context, () => logger[method](`Concluded ${operation}: ${outcome}`, undefined, {
        ...metadata, ...details, phase: 'end', outcome, durationMs: performance.now() - start,
      }));
    },
  };
}

export async function runOperation<T>(
  logger: Logger,
  operation: string,
  work: () => Promise<T>,
  options: {
    metadata?: DiagnosticMetadata;
    classify?: (result: T) => OperationOutcome;
    classifyError?: (error: unknown) => OperationOutcome;
  } = {},
): Promise<T> {
  const scope = beginOperation(logger, operation, options.metadata);
  return runWithDiagnosticContext(scope.context, async () => {
    try {
      const result = await work();
      scope.finish(options.classify?.(result) ?? 'success');
      return result;
    } catch (error: unknown) {
      scope.finish(options.classifyError?.(error) ?? 'failure', safeErrorMetadata(error));
      throw error;
    }
  });
}
