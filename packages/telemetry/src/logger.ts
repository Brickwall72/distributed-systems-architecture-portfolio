// File: shared/telemetry/logger.ts

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  correlationId: string | null;
  message: string;
}

/**
 * High-Performance Structured Logger Instance
 * Forces uniform JSON outputs to provide clean processing trails for cluster logs.
 */
export function createLogger(subsystemName: string) {
  const emit = (level: LogLevel, message: string, correlationId: string | null = null) => {
    const logPayload: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      subsystem: subsystemName,
      correlationId,
      message
    };
    
    // Emit as a single-line string to optimize tracking indexing performance
    console.log(JSON.stringify(logPayload));
  };

  return {
    info: (msg: string, cid: string | null = null) => emit('INFO', msg, cid),
    warn: (msg: string, cid: string | null = null) => emit('WARN', msg, cid),
    error: (msg: string, cid: string | null = null) => emit('ERROR', msg, cid),
    debug: (msg: string, cid: string | null = null) => emit('DEBUG', msg, cid)
  };
}
