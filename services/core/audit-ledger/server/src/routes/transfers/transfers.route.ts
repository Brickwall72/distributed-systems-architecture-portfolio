// File: services/core/audit-ledger/server/src/routes/transfers/transfers.route.ts
import { initServer } from '@ts-rest/express';
import { z } from 'zod';
import { createLogger, orgScope } from '@shared/express';
import type { Request } from 'express';
import { transfersRoutes } from 'audit-shared';
import { LedgerService } from '../../services';
import type { AccessScope } from '../../repositories';

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
const scopeFor = (req: Pick<Request, 'identity'>): AccessScope | null => {
  if (!req.identity) return null;
  const orgId = orgScope(req.identity);
  if (orgId === null) return null;
  return orgId === undefined ? { kind: 'auditor' } : { kind: 'organization', orgId };
};
const denied = (req: Pick<Request, 'identity'>) => req.identity
  ? { status: 403 as const, body: errorBody('FORBIDDEN', 'Insufficient access') }
  : { status: 401 as const, body: errorBody('UNAUTHORIZED', 'Authentication required') };

/** Read-only: every ledger write arrives through the NATS consumers, never HTTP. */
export function createTransfersRouter(deps: TransfersRouterDeps) {
  const { ledgerService } = deps;

  return s.router(transfersRoutes, {
    getTransfers: async ({ query, req }) => {
      const correlationId = correlationOf(req.headers);
      const scope = scopeFor(req);
      if (!scope) return denied(req);
      try {
        return { status: 200 as const, body: await ledgerService.listTransfers(query, scope) };
      } catch (err) {
        return serverError(err, 'GET /transfers failed', correlationId);
      }
    },

    getTransfer: async ({ params: { requisitionNumber }, req }) => {
      const correlationId = correlationOf(req.headers);
      const scope = scopeFor(req);
      if (!scope) return denied(req);
      try {
        const record = await ledgerService.getSealedTransfer(requisitionNumber, scope);
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

    getTransferDocument: async ({ params: { requisitionNumber }, req }) => {
      req.res?.setHeader('Cache-Control', 'no-store');
      const scope = scopeFor(req);
      if (!scope) return denied(req);
      try {
        const result = await ledgerService.getTransferDocument(requisitionNumber, scope);
        if (result.status === 'NOT_FOUND') {
          return { status: 404 as const, body: errorBody('NOT_FOUND', 'Sealed transfer not found.') };
        }
        if (result.status === 'NOT_READY') {
          return { status: 409 as const, body: errorBody('NOT_READY', 'Transfer overview is not ready.') };
        }
        return { status: 200 as const, body: { presignedUrl: result.presignedUrl } };
      } catch (error) {
        logger.error(`GET /transfers/:requisitionNumber/document failed: ${error instanceof Error ? error.name : 'Unknown error'}`, correlationOf(req.headers));
        return { status: 500 as const, body: errorBody('INTERNAL_SERVER_ERROR', 'Could not retrieve transfer overview.') };
      }
    },

    verifyTransfer: async ({ params: { requisitionNumber }, req }) => {
      const correlationId = correlationOf(req.headers);
      const scope = scopeFor(req);
      if (!scope) return denied(req);
      try {
        const result = await ledgerService.verifyTransfer(requisitionNumber, scope);
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
      const scope = scopeFor(req);
      if (scope?.kind !== 'auditor') return denied(req);
      try {
        return { status: 200 as const, body: await ledgerService.verifyLedger() };
      } catch (err) {
        return serverError(err, 'GET /ledger/verify failed', correlationId);
      }
    },

    getDeadLetters: async ({ req }) => {
      const correlationId = correlationOf(req.headers);
      const scope = scopeFor(req);
      if (scope?.kind !== 'auditor') return denied(req);
      try {
        return { status: 200 as const, body: await ledgerService.listDeadLetters() };
      } catch (err) {
        return serverError(err, 'GET /dead-letters failed', correlationId);
      }
    },
  });
}
