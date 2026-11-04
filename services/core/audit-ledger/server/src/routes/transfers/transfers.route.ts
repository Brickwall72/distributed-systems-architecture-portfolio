// File: services/core/audit-ledger/server/src/routes/transfers/transfers.route.ts
import { initServer } from '@ts-rest/express';
import { z } from 'zod';
import { createLogger } from '@shared/express';
import { transfersRoutes } from 'audit-shared';
import { LedgerService } from '../../services';

export const transfersRouterDepsSchema = z.object({
  ledgerService: z.instanceof(LedgerService),
});
type TransfersRouterDeps = z.infer<typeof transfersRouterDepsSchema>;

const logger = createLogger('audit-server:transfers');
const s = initServer();

const errorBody = (code: string, error: string) => ({ error, code, timestamp: new Date().toISOString() });
const serverError = (err: unknown, context: string, correlationId: string | null) => {
  logger.error(`${context}: ${err}`, correlationId);
  return {
    status: 500 as const,
    body: errorBody('INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Internal server error.'),
  };
};
const correlationOf = (headers: Record<string, unknown>) => (headers['x-correlation-id'] as string) || null;

/** Read-only: every ledger write arrives through the NATS consumers, never HTTP. */
export function createTransfersRouter(deps: TransfersRouterDeps) {
  const { ledgerService } = deps;

  return s.router(transfersRoutes, {
    getTransfers: async ({ query, req }) => {
      const correlationId = correlationOf(req.headers);
      try {
        return { status: 200 as const, body: await ledgerService.listTransfers(query) };
      } catch (err) {
        return serverError(err, 'GET /transfers failed', correlationId);
      }
    },

    getTransfer: async ({ params: { requisitionNumber }, req }) => {
      const correlationId = correlationOf(req.headers);
      try {
        const record = await ledgerService.getSealedTransfer(requisitionNumber);
        if (!record) {
          return {
            status: 404 as const,
            body: errorBody('NOT_FOUND', `No sealed record exists for requisition '${requisitionNumber}'.`),
          };
        }
        return { status: 200 as const, body: record };
      } catch (err) {
        return serverError(err, `GET /transfers/${requisitionNumber} failed`, correlationId);
      }
    },

    verifyTransfer: async ({ params: { requisitionNumber }, req }) => {
      const correlationId = correlationOf(req.headers);
      try {
        const result = await ledgerService.verifyTransfer(requisitionNumber);
        if (!result) {
          return {
            status: 404 as const,
            body: errorBody('NOT_FOUND', `No sealed record exists for requisition '${requisitionNumber}'.`),
          };
        }
        return { status: 200 as const, body: result };
      } catch (err) {
        return serverError(err, `GET /transfers/${requisitionNumber}/verify failed`, correlationId);
      }
    },

    verifyLedger: async ({ req }) => {
      const correlationId = correlationOf(req.headers);
      try {
        return { status: 200 as const, body: await ledgerService.verifyLedger() };
      } catch (err) {
        return serverError(err, 'GET /ledger/verify failed', correlationId);
      }
    },

    getDeadLetters: async ({ req }) => {
      const correlationId = correlationOf(req.headers);
      try {
        return { status: 200 as const, body: await ledgerService.listDeadLetters() };
      } catch (err) {
        return serverError(err, 'GET /dead-letters failed', correlationId);
      }
    },
  });
}
