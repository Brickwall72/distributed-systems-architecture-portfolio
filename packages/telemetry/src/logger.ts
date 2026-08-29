// File: packages/telemetry/src/logger.ts

/**
 * Severity levels supported by the shared structured logger.
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Standard log payload emitted to stdout for downstream log aggregation.
 */
export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  correlationId: string | null;
  message: string;
}

/**
 * Creates a consistent logging facade for a subsystem.
 *
 * Every log entry is serialized as a single JSON object to keep output
 * predictable for log shippers, trace correlation, and operational dashboards.
 *
 * @param subsystemName - Logical component or service name attached to each entry.
 * @returns Logger methods for the supported severity levels.
 */
export function createLogger(subsystemName: string) {
  const emit = (level: LogLevel, message: string, correlationId: string | null = null) => {
    const logPayload: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      subsystem: subsystemName,
      correlationId,
      message,
    };

    // Emit each record as a single JSON line so indexing and alerting remain simple.
    console.log(JSON.stringify(logPayload));
  };

  return {
    info: (msg: string, cid: string | null = null) => emit('INFO', msg, cid),
    warn: (msg: string, cid: string | null = null) => emit('WARN', msg, cid),
    error: (msg: string, cid: string | null = null) => emit('ERROR', msg, cid),
    debug: (msg: string, cid: string | null = null) => emit('DEBUG', msg, cid),
  };
}
