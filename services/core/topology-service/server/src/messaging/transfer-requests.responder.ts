// File: services/core/topology-service/server/src/messaging/transfer-requests.responder.ts
import { createLogger } from '@shared/express';
import type { EventBroker } from '@shared/messaging';
import {
  TOPOLOGY_REQUEST_SUBJECTS, transferClaimSchema, transferDraftValidationSchema,
  reserveTransferResponseSchema, validateDraftResponseSchema,
} from '@contracts/topology';
import { TransferClaimConflict, type TransferClaimsRepository, type TransferDraftRepository } from '../repositories/transfers';

const logger = createLogger('topology:transfer-requests');

export function registerTransferRequestResponders(
  broker: Pick<EventBroker, 'respond'>,
  claims: Pick<TransferClaimsRepository, 'reserveForSigning'>,
  drafts: Pick<TransferDraftRepository, 'validate'>,
): void {
  broker.respond(TOPOLOGY_REQUEST_SUBJECTS.VALIDATE_DRAFT, async (input: unknown) => {
    const parsed = transferDraftValidationSchema.safeParse(input);
    if (!parsed.success) return validateDraftResponseSchema.parse({ status: 'INVALID', message: 'Invalid draft validation request' });
    try {
      return validateDraftResponseSchema.parse({ status: 'OK', facts: await drafts.validate(parsed.data) });
    } catch (error: unknown) {
      if (error instanceof TransferClaimConflict) {
        return validateDraftResponseSchema.parse({ status: 'CONFLICT', message: 'Transfer state is not available' });
      }
      logger.error(`Draft validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return validateDraftResponseSchema.parse({ status: 'UNAVAILABLE', message: 'Draft validation failed' });
    }
  }, { queue: 'topology-transfer-validation' });

  broker.respond(TOPOLOGY_REQUEST_SUBJECTS.RESERVE, async (input: unknown) => {
    const parsed = transferClaimSchema.safeParse(input);
    if (!parsed.success) return reserveTransferResponseSchema.parse({ status: 'INVALID', message: 'Invalid reservation request' });
    try {
      return reserveTransferResponseSchema.parse({ status: 'OK', ...await claims.reserveForSigning(parsed.data) });
    } catch (error: unknown) {
      if (error instanceof TransferClaimConflict) {
        return reserveTransferResponseSchema.parse({ status: 'CONFLICT', message: 'Transfer state is not available' });
      }
      logger.error(`Transfer reservation failed: ${error instanceof Error ? error.message : String(error)}`);
      return reserveTransferResponseSchema.parse({ status: 'UNAVAILABLE', message: 'Transfer reservation failed' });
    }
  }, { queue: 'topology-transfer-reservations' });
}
