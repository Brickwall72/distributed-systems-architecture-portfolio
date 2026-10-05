// File: packages/express/src/middleware/errorHandler/errorHandler.ts
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { Logger } from '../../telemetry';
import { AppError } from './errors';

/**
 * Creates an Express error-handling middleware instance bound to a service's logger facade.
 *
 * @param logger - Subsystem logger instantiated via createLogger().
 */
export const createErrorHandler = (logger: Logger): ErrorRequestHandler => {

  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    // Resolve correlation ID from incoming request headers or fallback to null
    const rawCorrelationId = req.headers['x-correlation-id'] ?? req.headers['x-request-id'];
    const correlationId = typeof rawCorrelationId === 'string' ? rawCorrelationId : null;

    // 1. Zod Schema Validation Failure (HTTP 400)
    if (err instanceof z.ZodError) {
      logger.warn(`Schema validation failed on ${req.method} ${req.path}`, correlationId);
      res.status(400).json({
        error: 'Validation failed',
        details: err.issues,
      });
      return;
    }

    // 2. Malformed JSON Body Payload (HTTP 400)
    if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
      logger.warn(`Malformed JSON payload received on ${req.method} ${req.path}`, correlationId);
      res.status(400).json({ error: 'Invalid JSON payload.' });
      return;
    }

    // 3. Known Operational Domain Errors (HTTP 4xx / 5xx)
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error(`Operational error (${err.statusCode}): ${err.message}`, correlationId);
      } else {
        logger.warn(`Operational warning (${err.statusCode}): ${err.message}`, correlationId);
      }

      res.status(err.statusCode).json({
        error: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      });
      return;
    }

    // 4. Unhandled System Faults (HTTP 500)
    const errorMessage = err instanceof Error ? err.stack || err.message : String(err);
    logger.error(`Unhandled internal server error on ${req.method} ${req.path}: ${errorMessage}`, correlationId);

    res.status(500).json({ error: 'Internal server error' });
  };
};