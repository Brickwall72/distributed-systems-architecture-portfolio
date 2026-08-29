// File: packages/telemetry/src/index.ts

/**
 * Public API surface for the shared telemetry package.
 *
 * The package exposes a minimal, service-agnostic contract for health
 * monitoring and structured logging so callers can attach consistent
 * observability without depending on a specific service implementation.
 */
export { createHealthCheck } from './health.js';
export { createLogger } from './logger.js';
export type { LogLevel, StructuredLog } from './logger.js';
