// File: packages/express/src/middleware/errorHandler/errorHandler.unit.test.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createErrorHandler } from './errorHandler';
import { AppError, NotFoundError, ConflictError } from './errors';
import { Logger } from '../../telemetry';

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
      'Schema validation failed on POST /api/v1/documents',
      null
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
      'Malformed JSON payload received on POST /api/v1/documents',
      null
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
      'Operational warning (404): E-signature record missing',
      null
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
      'Operational error (503): Upstream storage service unavailable',
      null
    );
  });

  it('handles unhandled Error objects with HTTP 500 and logs full stack trace', () => {
    const handler = createErrorHandler(mockLogger);
    const unhandledError = new Error('Database connection reset');

    handler(unhandledError, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Database connection reset'),
      null
    );
  });

  it('handles non-Error throwables with HTTP 500', () => {
    const handler = createErrorHandler(mockLogger);

    handler('String exception', req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled internal server error on POST /api/v1/documents: String exception',
      null
    );
  });

  describe('Correlation ID Header Extraction', () => {
    it('extracts correlation ID from x-correlation-id header', () => {
      req.headers = { 'x-correlation-id': 'corr-abc-123' };
      const handler = createErrorHandler(mockLogger);

      handler(new NotFoundError(), req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operational warning (404): Resource not found',
        'corr-abc-123'
      );
    });

    it('falls back to x-request-id when x-correlation-id is absent', () => {
      req.headers = { 'x-request-id': 'req-xyz-789' };
      const handler = createErrorHandler(mockLogger);

      handler(new NotFoundError(), req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operational warning (404): Resource not found',
        'req-xyz-789'
      );
    });

    it('passes null correlation ID when header values are non-string or missing', () => {
      req.headers = {};
      const handler = createErrorHandler(mockLogger);

      handler(new NotFoundError(), req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operational warning (404): Resource not found',
        null
      );
    });
  });
});