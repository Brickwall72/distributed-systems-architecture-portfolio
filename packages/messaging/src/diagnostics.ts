// File: packages/messaging/src/diagnostics.ts
import { headers, NoRespondersError, TimeoutError, type MsgHdrs } from '@nats-io/transport-node';
import {
  validDiagnosticId,
  type DiagnosticContext,
  type DiagnosticMetadata,
  type Logger,
} from '@shared/diagnostics';

export const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

export const CORRELATION_HEADER = 'x-correlation-id';
export const OPERATION_HEADER = 'x-operation-id';
export const PARENT_OPERATION_HEADER = 'x-parent-operation-id';

export function headerId(messageHeaders: MsgHdrs | undefined, name: string): string | undefined {
  if (!messageHeaders) return undefined;
  const values = messageHeaders.values(name);
  return values.length === 1 && validDiagnosticId(values[0]) ? values[0] : undefined;
}

export function diagnosticHeaders(context: DiagnosticContext) {
  const result = headers();
  result.set(CORRELATION_HEADER, context.correlationId);
  if (context.operationId) result.set(OPERATION_HEADER, context.operationId);
  if (context.parentOperationId) result.set(PARENT_OPERATION_HEADER, context.parentOperationId);
  return result;
}

export function eventMetadata(payload: unknown): DiagnosticMetadata {
  if (!payload || typeof payload !== 'object') return {};
  const event = payload as { id?: unknown; correlationId?: unknown };
  return {
    ...(validDiagnosticId(event.id) ? { eventId: event.id } : {}),
    ...(validDiagnosticId(event.correlationId) ? { eventCorrelationId: event.correlationId } : {}),
  };
}

export function requestFailureCode(error: unknown): { code: string; outcome: 'rejected' | 'failure' } {
  if (error instanceof TimeoutError) return { code: 'timeout', outcome: 'rejected' };
  if (error instanceof NoRespondersError) return { code: 'no_responders', outcome: 'rejected' };
  if (error instanceof SyntaxError) return { code: 'invalid_reply', outcome: 'failure' };
  return { code: 'request_failed', outcome: 'failure' };
}
