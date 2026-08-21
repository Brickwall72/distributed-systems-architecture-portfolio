// File: shared/telemetry/logger.unit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from './logger.js';

describe('Unit Test: Structured Telemetry JSON Logging Engine (logger)', () => {
  let logSpy: any;

  beforeEach(() => {
    // Intercept console.log to keep the test runner clean while parsing output data strings
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should compile message strings into a strict single-line JSON format with telemetry attributes', () => {
    const logger = createLogger('compliance-service');
    logger.info('Gateway connection established.', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');

    expect(logSpy).toHaveBeenCalled();
    const rawOutputString = logSpy.mock.calls[0][0];
    
    // Validate that the output parses as a standard JSON configuration
    const parsedPayload = JSON.parse(rawOutputString);
    expect(parsedPayload.level).toBe('INFO');
    expect(parsedPayload.subsystem).toBe('compliance-service');
    expect(parsedPayload.correlationId).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    expect(parsedPayload.message).toBe('Gateway connection established.');
    expect(parsedPayload).toHaveProperty('timestamp');
  });
});
