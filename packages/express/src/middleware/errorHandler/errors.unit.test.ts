// File: packages/express/src/middleware/errorHandler/errors.unit.test.ts
import { AppError, NotFoundError, ConflictError } from './errors';

describe('Operational Error Classes', () => {
  describe('AppError', () => {
    it('instantiates correctly with statusCode, message, and optional details', () => {
      const details = { field: 'email', reason: 'invalid' };
      const err = new AppError(422, 'Unprocessable Entity', details);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(422);
      expect(err.message).toBe('Unprocessable Entity');
      expect(err.details).toEqual(details);
    });

    it('leaves details undefined when omitted', () => {
      const err = new AppError(400, 'Bad Request');

      expect(err.details).toBeUndefined();
    });
  });

  describe('NotFoundError', () => {
    it('defaults to status code 404 and default message', () => {
      const err = new NotFoundError();

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Resource not found');
      expect(err.details).toBeUndefined();
    });

    it('accepts a custom error message', () => {
      const err = new NotFoundError('User record not found');

      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('User record not found');
    });
  });

  describe('ConflictError', () => {
    it('sets status code 409, message, and details', () => {
      const details = { resourceId: 'doc-123' };
      const err = new ConflictError('Document already locked', details);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe('Document already locked');
      expect(err.details).toEqual(details);
    });
  });
});