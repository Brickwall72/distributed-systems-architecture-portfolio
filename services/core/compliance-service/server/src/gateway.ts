// File: services/core/compliance-service/src/gateway.ts
import { Router, Request, Response } from 'express';

const router = Router();
const COMPLIANCE_TIMEOUT_MS = 2000;

router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const correlationId = req.header('X-Correlation-ID');
  const timestamp = new Date().toISOString();

  if (!correlationId || correlationId.trim().length === 0) {
    res.status(400).json({
      errorCode: 'MISSING_CORRELATION_TOKEN',
      message: 'The execution command lacks an active tracing tracking identifier token.',
      correlationId: 'UNKNOWN',
      timestamp
    });
    return;
  }

  const abortController = new AbortController();
  let timerId: NodeJS.Timeout | undefined;

  try {
    const { sourceAssetId, targetAssetId, actionContext } = req.body;

    const topologyTask = fetch('https://cluster.local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId },
      body: JSON.stringify({ sourceAssetId, targetAssetId, actionContext }),
      signal: abortController.signal
    });

    const telemetryTask = fetch(`https://cluster.local{sourceAssetId}`, {
      method: 'GET',
      headers: { 'X-Correlation-ID': correlationId },
      signal: abortController.signal
    });

    // In-Line Timeout: Rejects and immediately fires the abort network kill switch
    const timeoutBoundary = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        abortController.abort();
        reject(new Error('TIMEOUT_LIMIT_EXCEEDED'));
      }, COMPLIANCE_TIMEOUT_MS);
    });

    // Race the tasks against the defensive timeout fuse
    await Promise.race([
      Promise.all([topologyTask, telemetryTask]),
      timeoutBoundary
    ]);

    // Clean up the active system timer if network tasks resolve successfully under 2000ms
    if (timerId) clearTimeout(timerId);

    res.setHeader('X-Correlation-ID', correlationId);
    res.status(200).json({ status: 'VALIDATION_PASSED', correlationId, timestamp });

  } catch (caughtError: any) {
    if (timerId) clearTimeout(timerId);
    console.error(`[compliance-service] Gate execution failure under tracking token [${correlationId}]:`, caughtError);

    if (caughtError.message === 'TIMEOUT_LIMIT_EXCEEDED' || caughtError.name === 'AbortError') {
      res.status(504).json({
        errorCode: 'VALIDATION_GATE_TIMEOUT',
        message: 'The dependent verification endpoints failed to resolve within the authorized safety window.',
        correlationId,
        timestamp
      });
      return;
    }

    res.status(500).json({
      errorCode: 'INTERNAL_GATE_FAULT',
      message: 'An unexpected processing fault occurred during validation processing.',
      correlationId,
      timestamp
    });
  }
});

export { router as complianceGateway };
