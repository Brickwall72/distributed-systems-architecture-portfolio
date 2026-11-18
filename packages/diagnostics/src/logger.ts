// File: packages/diagnostics/src/logger.ts
import { getDiagnosticContext, validDiagnosticId } from './context';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type OperationOutcome = 'success' | 'rejected' | 'failure' | 'deferred' | 'aborted' | 'discarded'
  | 'reply_received' | 'reply_sent';

export interface DiagnosticMetadata {
  operation?: string;
  operationId?: string;
  parentOperationId?: string;
  phase?: 'start' | 'end';
  outcome?: OperationOutcome;
  durationMs?: number;
  method?: string;
  route?: string;
  statusCode?: number;
  subject?: string;
  documentId?: string;
  eventId?: string;
  eventCorrelationId?: string;
  sequence?: number;
  errorType?: string;
  errorCode?: string;
}

export interface StructuredLog extends DiagnosticMetadata {
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  correlationId: string | null;
  message: string;
}

export interface Logger {
  info(message: string, correlationId?: string | null, metadata?: DiagnosticMetadata): void;
  warn(message: string, correlationId?: string | null, metadata?: DiagnosticMetadata): void;
  error(message: string, correlationId?: string | null, metadata?: DiagnosticMetadata): void;
  debug(message: string, correlationId?: string | null, metadata?: DiagnosticMetadata): void;
}

export function safeErrorMetadata(error: unknown): DiagnosticMetadata {
  let errorType: string;
  if (error instanceof SyntaxError) {
    errorType = 'SyntaxError';
  } else if (error instanceof TypeError) {
    errorType = 'TypeError';
  } else if (error instanceof RangeError) {
    errorType = 'RangeError';
  } else if (error instanceof Error) {
    errorType = 'Error';
  } else {
    errorType = 'NonError';
  }
  return { errorType };
}

function pickMetadata(metadata: DiagnosticMetadata | undefined): DiagnosticMetadata {
  const result: DiagnosticMetadata = { phase: metadata?.phase, outcome: metadata?.outcome };
  for (const key of [
    'operation', 'operationId', 'parentOperationId', 'method', 'route', 'subject',
    'documentId', 'eventId', 'eventCorrelationId', 'errorType', 'errorCode',
  ] as const) {
    const value = metadata?.[key];
    if (typeof value === 'string') result[key] = value.slice(0, 256);
  }
  for (const key of ['durationMs', 'statusCode', 'sequence'] as const) {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

export function createLogger(subsystem: string): Logger {
  const emit = (level: LogLevel, message: string, correlationId?: string | null, metadata?: DiagnosticMetadata) => {
    const context = getDiagnosticContext();
    const details = pickMetadata(metadata);
    let resolvedCorrelationId: string | null;
    if (correlationId === undefined) {
      resolvedCorrelationId = context?.correlationId ?? null;
    } else if (validDiagnosticId(correlationId)) {
      resolvedCorrelationId = correlationId;
    } else {
      resolvedCorrelationId = null;
    }
    const log: StructuredLog = {
      ...details,
      operation: details.operation ?? context?.operation,
      operationId: details.operationId ?? context?.operationId,
      parentOperationId: details.parentOperationId ?? context?.parentOperationId,
      timestamp: new Date().toISOString(),
      level,
      subsystem,
      correlationId: resolvedCorrelationId,
      message,
    };
    console.log(JSON.stringify(log));
  };
  return {
    info: (message, id, metadata) => emit('INFO', message, id, metadata),
    warn: (message, id, metadata) => emit('WARN', message, id, metadata),
    error: (message, id, metadata) => emit('ERROR', message, id, metadata),
    debug: (message, id, metadata) => emit('DEBUG', message, id, metadata),
  };
}
