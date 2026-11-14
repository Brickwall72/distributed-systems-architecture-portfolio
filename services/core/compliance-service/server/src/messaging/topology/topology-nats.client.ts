// File: services/core/compliance-service/server/src/messaging/topology/topology-nats.client.ts
import type { EventBroker } from '@shared/messaging';
import {
  TOPOLOGY_REQUEST_SUBJECTS, transferClaimSchema, transferDraftValidationSchema,
  reserveTransferResponseSchema, validateDraftResponseSchema,
  type TransferClaim, type TransferDraftValidation,
} from '@contracts/topology';
import { TopologyConflict, TopologyUnavailable } from './topology-errors';

export class TopologyNatsClient {
  constructor(private readonly broker: Pick<EventBroker, 'request'>) {}

  async validateDraft(input: TransferDraftValidation) {
    const body = await this.request(TOPOLOGY_REQUEST_SUBJECTS.VALIDATE_DRAFT, transferDraftValidationSchema.parse(input));
    const response = validateDraftResponseSchema.safeParse(body);
    if (!response.success) throw new TopologyUnavailable('Topology returned an invalid draft validation response');
    if (response.data.status === 'CONFLICT') throw new TopologyConflict(response.data.message);
    if (response.data.status !== 'OK') throw new TopologyUnavailable(response.data.message);
    return response.data.facts;
  }

  async reserve(input: TransferClaim) {
    const claim = transferClaimSchema.parse(input);
    const body = await this.request(TOPOLOGY_REQUEST_SUBJECTS.RESERVE, claim);
    const response = reserveTransferResponseSchema.safeParse(body);
    if (!response.success) throw new TopologyUnavailable('Topology returned an invalid reservation response');
    if (response.data.status === 'CONFLICT') throw new TopologyConflict(response.data.message);
    if (response.data.status !== 'OK') throw new TopologyUnavailable(response.data.message);
    return { transferEventId: response.data.transferEventId };
  }

  private async request(subject: string, input: unknown): Promise<unknown> {
    try {
      return await this.broker.request(subject, input, { timeout: 10_000 });
    } catch (error: unknown) {
      throw new TopologyUnavailable('Topology service is unavailable', { cause: error });
    }
  }
}
