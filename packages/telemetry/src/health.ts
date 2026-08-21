// File: shared/middleware/health.ts
import { Request, Response } from 'express';

/**
 * Universal Health Check Factory (REQ-001 Blueprint)
 * Generates an immutable, uniform Express router handler tracking container viability.
 * @param serviceName The unique structural identifier string for the host container.
 */
export function createHealthCheck(serviceName: string) {
  return (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'HEALTHY',
      service: serviceName,
      timestamp: new Date().toISOString()
    });
  };
}
