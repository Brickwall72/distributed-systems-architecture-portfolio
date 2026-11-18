// File: packages/diagnostics/src/context.ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface DiagnosticContext {
  readonly correlationId: string;
  readonly operation?: string;
  readonly operationId?: string;
  readonly parentOperationId?: string;
}

const storage = new AsyncLocalStorage<DiagnosticContext>();

export function validDiagnosticId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && !/[^A-Za-z0-9._:-]/.test(value);
}

export function diagnosticId(value?: unknown): string {
  return validDiagnosticId(value) ? value : randomUUID();
}

export function getDiagnosticContext(): DiagnosticContext | undefined {
  return storage.getStore();
}

export function runWithDiagnosticContext<T>(context: DiagnosticContext, work: () => T): T {
  return storage.run(context, work);
}

export function runInNewDiagnosticContext<T>(work: () => T, correlationId?: unknown): T {
  return storage.run({ correlationId: diagnosticId(correlationId) }, work);
}

export function withoutDiagnosticContext<T>(work: () => T): T {
  return storage.exit(work);
}
