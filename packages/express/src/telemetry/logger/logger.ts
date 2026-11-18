// File: packages/express/src/telemetry/logger/logger.ts

export {
  beginOperation, createLogger, diagnosticId, getDiagnosticContext, runInNewDiagnosticContext,
  runOperation, runWithDiagnosticContext, safeErrorMetadata, validDiagnosticId, withoutDiagnosticContext,
  startTracing, stopTracing, runWithoutTrace,
} from '@shared/diagnostics';
export type {
  DiagnosticContext, DiagnosticMetadata, Logger, LogLevel, OperationOutcome, StructuredLog,
} from '@shared/diagnostics';