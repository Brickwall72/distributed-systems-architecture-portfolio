// File: packages/express/src/middleware/errorHandler/errorHandler.ts
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { getDiagnosticContext, safeErrorMetadata } from '@shared/diagnostics';
import { Logger } from '../../telemetry';
import { AppError } from './errors';

/**
 * Creates an Express error-handling middleware instance bound to a service's logger facade.
 *
 * @param logger - Subsystem logger instantiated via createLogger().
 */
export const createErrorHandler = (logger: Logger): ErrorRequestHandler => {

  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (res.headersSent) {
      _next(err);
      return;
    }

    const correlationId = getDiagnosticContext()?.correlationId ?? null;
    const metadata = {
      method: req.method,
      route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
    };

    // 1. Zod Schema Validation Failure (HTTP 400)
    if (err instanceof z.ZodError) {
      logger.warn('Schema validation failed', correlationId, {
        ...metadata, ...safeErrorMetadata(err), statusCode: 400,
      });
      res.status(400).json({
        error: 'Validation failed',
        details: err.issues,
      });
      return;
    }

    // 2. Malformed JSON Body Payload (HTTP 400)
    if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
      logger.warn('Malformed JSON payload received', correlationId, {
        ...metadata, ...safeErrorMetadata(err), statusCode: 400,
      });
      res.status(400).json({ error: 'Invalid JSON payload.' });
      return;
    }

    // 3. Known Operational Domain Errors (HTTP 4xx / 5xx)
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error('Operational request error', correlationId, {
          ...metadata, statusCode: err.statusCode, errorType: 'AppError',
        });
      } else {
        logger.warn('Operational request rejected', correlationId, {
          ...metadata, statusCode: err.statusCode, errorType: 'AppError',
        });
      }

      res.status(err.statusCode).json({
        error: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      });
      return;
    }

    // 4. Unhandled System Faults (HTTP 500)
    logger.error('Unhandled internal server error', correlationId, {
      ...metadata,
      statusCode: 500,
      ...safeErrorMetadata(err),
    });

    res.status(500).json({ error: 'Internal server error' });
  };
};