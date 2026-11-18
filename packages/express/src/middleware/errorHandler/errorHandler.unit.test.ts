// File: packages/express/src/middleware/errorHandler/errorHandler.unit.test.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createErrorHandler } from './errorHandler';
import { AppError, NotFoundError, ConflictError } from './errors';
import { Logger } from '../../telemetry';
import { runWithDiagnosticContext } from '@shared/diagnostics';

describe('createErrorHandler Middleware', () => {
  let mockLogger: Logger;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    req = {
      method: 'POST',
      path: '/api/v1/documents',
      headers: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  it('handles z.ZodError with HTTP 400 and logs warning', () => {
    const handler = createErrorHandler(mockLogger);

    // Generate a real z.ZodError via schema validation instead of manually constructing deprecated issue types
    const parseResult = z.object({ title: z.string() }).safeParse({ title: 123 });
    if (parseResult.success) {
      throw new Error('Test setup failed: expected safeParse to fail');
    }

    const zodError = parseResult.error;

    handler(zodError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: zodError.issues,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Schema validation failed',
      null,
      expect.objectContaining({ method: 'POST', route: 'unmatched', statusCode: 400 })
    );
  });

  it('handles malformed JSON SyntaxError with HTTP 400 and logs warning', () => {
    const handler = createErrorHandler(mockLogger);
    const syntaxError = new SyntaxError('Unexpected token in JSON');
    Object.assign(syntaxError, { status: 400 });

    handler(syntaxError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON payload.' });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Malformed JSON payload received',
      null,
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('handles 4xx AppError subclasses (NotFoundError) with details and logs warning', () => {
    const handler = createErrorHandler(mockLogger);
    const notFoundError = new NotFoundError('E-signature record missing');

    handler(notFoundError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'E-signature record missing',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Operational request rejected',
      null,
      expect.objectContaining({ statusCode: 404 })
    );
  });

  it('includes details in response when present on operational AppError', () => {
    const handler = createErrorHandler(mockLogger);
    const conflictError = new ConflictError('Document already signed', {
      signedAt: '2026-10-04T00:00:00Z',
    });

    handler(conflictError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Document already signed',
      details: { signedAt: '2026-10-04T00:00:00Z' },
    });
  });

  it('handles 5xx AppError with HTTP 5xx status and logs error level', () => {
    const handler = createErrorHandler(mockLogger);
    const serverOperationalError = new AppError(503, 'Upstream storage service unavailable');

    handler(serverOperationalError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Upstream storage service unavailable',
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Operational request error',
      null,
      expect.objectContaining({ statusCode: 503 })
    );
  });

  it('handles unhandled Error objects with HTTP 500 without logging error details', () => {
    const handler = createErrorHandler(mockLogger);
    const unhandledError = new Error('Database connection reset');

    handler(unhandledError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled internal server error',
      null,
      expect.objectContaining({ statusCode: 500, errorType: 'Error' })
    );
  });

  it('handles non-Error throwables with HTTP 500', () => {
    const handler = createErrorHandler(mockLogger);

    handler('String exception', req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled internal server error',
      null,
      expect.objectContaining({ statusCode: 500, errorType: 'NonError' })
    );
  });

  describe('Diagnostic Context', () => {
    it('uses the active diagnostic context rather than reading raw request headers', () => {
      req.headers = { 'x-correlation-id': 'untrusted-header' };
      const handler = createErrorHandler(mockLogger);

      runWithDiagnosticContext({ correlationId: 'corr-abc-123' }, () => {
        handler(new NotFoundError(), req as Request, res as Response, next);
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operational request rejected',
        'corr-abc-123',
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('does not use a raw request ID header when context is absent', () => {
      req.headers = { 'x-request-id': 'untrusted-header' };
      const handler = createErrorHandler(mockLogger);

      handler(new NotFoundError(), req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operational request rejected',
        null,
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('delegates errors when response headers have already been sent', () => {
      res.headersSent = true;
      const handler = createErrorHandler(mockLogger);

      const error = new Error('not logged');
      handler(error, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});