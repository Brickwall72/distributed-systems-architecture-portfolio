// File: packages/telemetry/src/health.ts
import { Request, Response } from 'express';

/**
 * Creates a health-check middleware for a running service.
 *
 * The returned handler reports a standardized 200 response so deployment
 * tooling, orchestrators, and dashboards can validate service readiness with
 * one uniform contract.
 *
 * @param serviceName - Stable identifier for the service being monitored.
 * @returns Express middleware that returns a health payload with a timestamp.
 */
export function createHealthCheck(serviceName: string) {
  return (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'HEALTHY',
      service: serviceName,
      timestamp: new Date().toISOString(),
    });
  };
}
