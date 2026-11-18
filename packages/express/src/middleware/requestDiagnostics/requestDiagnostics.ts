// File: packages/express/src/middleware/requestDiagnostics/requestDiagnostics.ts
import type { NextFunction, Request, Response } from 'express';
import {
  beginOperation,
  diagnosticId,
  runWithDiagnosticContext,
  validDiagnosticId,
  type Logger,
} from '../../telemetry';

const HEALTH_PATHS = new Set(['/live', '/health', '/api/v1/health']);

function readSingleHeader(req: Request, name: string): { present: boolean; value?: unknown } {
  const rawHeaders = req.rawHeaders;
  if (Array.isArray(rawHeaders)) {
    const values: string[] = [];
    for (let index = 0; index < rawHeaders.length; index += 2) {
      if (rawHeaders[index]?.toLowerCase() === name) values.push(rawHeaders[index + 1]);
    }
    if (values.length > 0) return { present: true, value: values.length === 1 ? values[0] : undefined };
  }

  const value = req.headers[name];
  return { present: value !== undefined, value };
}

function routeTemplate(req: Request): string {
  return typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
}

function httpOutcome(statusCode: number): 'success' | 'rejected' | 'failure' {
  if (statusCode >= 500) return 'failure';
  if (statusCode >= 400) return 'rejected';
  return 'success';
}

export function createRequestDiagnostics(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const canonical = readSingleHeader(req, 'x-correlation-id');
    const fallback = canonical.present ? undefined : readSingleHeader(req, 'x-request-id');
    const selected = canonical.present ? canonical.value : fallback?.value;
    const correlationId = validDiagnosticId(selected) ? selected : diagnosticId();

    res.setHeader('x-correlation-id', correlationId);
    runWithDiagnosticContext({ correlationId }, () => {
      if ((canonical.present && !validDiagnosticId(canonical.value))
        || (!canonical.present && fallback?.present && !validDiagnosticId(fallback.value))) {
        logger.warn('Invalid diagnostic correlation ID replaced');
      }

      const isHealthPath = HEALTH_PATHS.has(req.path);
      const operation = beginOperation(logger, 'http.request', { method: req.method }, isHealthPath);
      let terminal = false;
      const finish = (premature: boolean) => {
        if (terminal) return;
        terminal = true;
        runWithDiagnosticContext(operation.context, () => {
          const outcome = premature ? 'aborted' : httpOutcome(res.statusCode);
          operation.finish(outcome, {
            method: req.method,
            route: routeTemplate(req),
            statusCode: res.statusCode,
          });
        });
      };

      res.once('finish', () => finish(false));
      res.once('close', () => {
        if (!res.writableFinished) finish(true);
      });

      runWithDiagnosticContext(operation.context, next);
    });
  };
}

export const requestDiagnostics = createRequestDiagnostics;
