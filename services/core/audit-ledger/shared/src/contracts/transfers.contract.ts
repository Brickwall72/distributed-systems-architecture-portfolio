// File: services/core/audit-ledger/shared/src/contracts/transfers.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ApiErrorResponseSchema } from '@contracts/common';
import {
  GetTransfersQuerySchema,
  sealedTransferSchema,
  transferSummarySchema,
  verificationResultSchema,
  deadLetterSchema,
} from '../schemas';

const c = initContract();

const requisitionNumberParamsSchema = z.object({ requisitionNumber: z.string().min(1) });

/** The ledger is read-only over HTTP; every write arrives through NATS consumers. */
export const transfersRoutes = {
  getTransfers: c.query({
    method: 'GET',
    path: '/transfers',
    query: GetTransfersQuerySchema,
    responses: {
      200: z.array(transferSummarySchema),
      500: ApiErrorResponseSchema,
    },
    summary: 'List sealed and still-open transfer records.',
  }),
  getTransfer: c.query({
    method: 'GET',
    path: '/transfers/:requisitionNumber',
    pathParams: requisitionNumberParamsSchema,
    responses: {
      200: sealedTransferSchema,
      404: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Retrieve a sealed transfer record by requisition number.',
  }),
  verifyTransfer: c.query({
    method: 'GET',
    path: '/transfers/:requisitionNumber/verify',
    pathParams: requisitionNumberParamsSchema,
    responses: {
      200: verificationResultSchema,
      404: ApiErrorResponseSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Recompute a sealed record hash and confirm it links to its predecessor.',
  }),
  verifyLedger: c.query({
    method: 'GET',
    path: '/ledger/verify',
    responses: {
      200: verificationResultSchema,
      500: ApiErrorResponseSchema,
    },
    summary: 'Verify the entire hash chain.',
  }),
  getDeadLetters: c.query({
    method: 'GET',
    path: '/dead-letters',
    responses: {
      200: z.array(deadLetterSchema),
      500: ApiErrorResponseSchema,
    },
    summary: 'Retrieve events held for review.',
  }),
};

export const transfersContract = c.router(transfersRoutes);
