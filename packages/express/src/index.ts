// File: packages/express/src/index.ts

/**
 * Public API surface for the shared telemetry package.
 *
 * The package exposes a minimal, service-agnostic contract for health
 * monitoring and structured logging so callers can attach consistent
 * observability without depending on a specific service implementation.
 */
export * from './middleware';
export * from './telemetry';
