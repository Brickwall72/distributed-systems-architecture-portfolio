// File: services/core/audit-ledger/server/src/services/ledger.service.ts
import {
  DEAD_LETTER_REASON,
  VERIFICATION_FAILURE,
  type DeadLetter,
  type DeadLetterReason,
  type SealedTransfer,
  type TransferSummary,
  type VerificationResult,
  type GetTransfersQuery,
  LEDGER_STATUS,
  RENDITION_STATUS,
} from 'audit-shared';
import { createLogger } from '@shared/express';
import { getMissingSignals } from '../domain';
import type { DraftsRepository, EventsRepository, SealedTransfersRepository, DeadLettersRepository, RenditionsRepository } from '../repositories';
import { getSignedDownloadUrlRequestSchema, type GetSignedDownloadUrlRequest } from '@shared/filestore';
import { isDuplicateKeyError } from '../repositories/mongo-errors';
import { draftToSealedTransfer, draftToSummary, sealedToSummary } from '../mappers';
import { computeRecordHash, GENESIS_HASH } from '../utils';
import type {
  EventMeta,
  HandleTransferCreatedInput,
  HandleTransferUpdatedInput,
  HandleTransferCompletedInput,
  HandleTransferInitiatedInput,
  HandleTransferReceivedInput,
} from './ledger.schemas';

const logger = createLogger('Audit:ledger-service');
const MAX_SEQUENCE_ATTEMPTS = 5;

export interface LedgerServiceDeps {
  events: EventsRepository;
  drafts: DraftsRepository;
  sealed: SealedTransfersRepository;
  deadLetters: DeadLettersRepository;
  now?: () => Date;
  onSealed?: () => void;
  renditions?: RenditionsRepository;
  getSignedDownloadUrl?: (request: GetSignedDownloadUrlRequest) => Promise<string>;
}

export class LedgerService {
  private readonly now: () => Date;

  constructor(private readonly deps: LedgerServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async handleTransferCreated({ meta, data }: HandleTransferCreatedInput): Promise<void> {
    await this.accumulate(meta, data.requisitionNumber, data, {
      transferEventId: data.transferEventId,
      transferType: data.transferType,
      date: data.date,
      sender: data.sender,
      receiver: data.receiver,
      assets: data.assets,
    });
  }

  async handleTransferUpdated({ meta, data }: HandleTransferUpdatedInput): Promise<void> {
    await this.accumulate(meta, data.requisitionNumber, data, {
      transferEventId: data.transferEventId,
      [`receivedAssets.${data.documentId}`]: data.receivedAssets,
    });
  }

  /** Completed carries everything created and updated carry, so it alone can populate a draft (C2 transfers). */
  async handleTransferCompleted({ meta, data }: HandleTransferCompletedInput): Promise<void> {
    await this.accumulate(meta, data.requisitionNumber, data, {
      transferEventId: data.transferEventId,
      transferType: data.transferType,
      date: data.date,
      sender: data.sender,
      receiver: data.receiver,
      assets: data.assets,
      topologyCompleted: true,
      completedAt: meta.occurredAt,
      ...(data.documentId ? { [`receivedAssets.${data.documentId}`]: data.receivedAssets } : {}),
    });
  }

  async handleTransferInitiated({ meta, data }: HandleTransferInitiatedInput): Promise<void> {
    const { requisitionNumber, ...authorization } = data;
    await this.accumulate(meta, requisitionNumber, data, { authorization });
  }

  async handleTransferReceived({ meta, data }: HandleTransferReceivedInput): Promise<void> {
    const { requisitionNumber, transferEventId, ...document } = data;
    await this.accumulate(meta, requisitionNumber, data, {
      transferEventId,
      [`receiptDocuments.${data.documentId}`]: document,
    });
  }

  /** Holds an event that failed validation so it can be reviewed instead of retried forever or lost. */
  async quarantine(
    reason: DeadLetterReason,
    subject: string,
    payload: unknown,
    detail: string,
    ids: { eventId?: string; requisitionNumber?: string } = {}
  ): Promise<void> {
    const entry: DeadLetter = {
      reason,
      subject,
      detail,
      payload,
      receivedAt: this.now().toISOString(),
      ...ids,
    };
    await this.deps.deadLetters.add(entry);
    logger.warn(`Dead-lettered ${reason} event on ${subject}: ${detail}`);
  }

  async listTransfers(query: GetTransfersQuery): Promise<TransferSummary[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    if (query.status === LEDGER_STATUS.SEALED) {
      return this.addRenditionStatus((await this.deps.sealed.list(limit, offset)).map(sealedToSummary));
    }
    if (query.status === LEDGER_STATUS.OPEN) {
      return (await this.deps.drafts.list(LEDGER_STATUS.OPEN, limit, offset)).map(draftToSummary);
    }
    // Sealed drafts are already represented by their immutable record, so only open drafts are merged in.
    const open = (await this.deps.drafts.list(LEDGER_STATUS.OPEN, limit + offset, 0)).map(draftToSummary);
    const sealed = (await this.deps.sealed.list(limit + offset, 0)).map(sealedToSummary);
    return this.addRenditionStatus([...open, ...sealed]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(offset, offset + limit));
  }

  private async addRenditionStatus(summaries: TransferSummary[]): Promise<TransferSummary[]> {
    if (!this.deps.renditions) return summaries;
    const sequences = summaries.flatMap((item) => item.sequence === undefined ? [] : [item.sequence]);
    const renditions = await this.deps.renditions.findBySequences(sequences);
    const statuses = new Map(renditions.map((item) => [item.sequence, item.status]));
    return summaries.map((item) => item.sequence === undefined ? item : {
      ...item, renditionStatus: statuses.get(item.sequence) ?? RENDITION_STATUS.PENDING,
    });
  }

  async getTransferDocument(requisitionNumber: string): Promise<
    { status: 'NOT_FOUND' } | { status: 'NOT_READY' } | { status: 'READY'; presignedUrl: string }
  > {
    if (!this.deps.renditions || !this.deps.getSignedDownloadUrl) throw new Error('Rendition retrieval is not configured');
    const record = await this.deps.sealed.findByRequisition(requisitionNumber);
    if (!record) return { status: 'NOT_FOUND' };
    const [rendition] = await this.deps.renditions.findBySequences([record.sequence]);
    if (rendition?.status !== 'READY') return { status: 'NOT_READY' };
    if (rendition.sourceRecordHash !== record.recordHash || !rendition.storageBucket || !rendition.storageKey) {
      throw new Error('Rendition metadata is invalid or does not match the sealed record');
    }
    return {
      status: 'READY',
      presignedUrl: await this.deps.getSignedDownloadUrl(getSignedDownloadUrlRequestSchema.parse(rendition)),
    };
  }

  getSealedTransfer(requisitionNumber: string): Promise<SealedTransfer | null> {
    return this.deps.sealed.findByRequisition(requisitionNumber);
  }

  listDeadLetters(): Promise<DeadLetter[]> {
    return this.deps.deadLetters.list();
  }

  async verifyTransfer(requisitionNumber: string): Promise<VerificationResult | null> {
    const record = await this.deps.sealed.findByRequisition(requisitionNumber);
    if (!record) return null;

    const failures: VerificationResult['failures'] = [];
    const { recordHash, ...body } = record;
    if (computeRecordHash(body) !== recordHash) {
      failures.push({ sequence: record.sequence, requisitionNumber, reason: VERIFICATION_FAILURE.HASH_MISMATCH });
    }
    return { valid: failures.length === 0, checked: 1, failures };
  }

  /** Walks the whole chain: each hash must recompute, each link must match, and sequences must be gapless. */
  async verifyLedger(): Promise<VerificationResult> {
    const failures: VerificationResult['failures'] = [];
    let checked = 0;
    let expectedSequence = 1;
    let expectedPrev = GENESIS_HASH;

    for await (const record of this.deps.sealed.iterateInOrder()) {
      checked++;
      const fail = (reason: (typeof VERIFICATION_FAILURE)[keyof typeof VERIFICATION_FAILURE]) =>
        failures.push({ sequence: record.sequence, requisitionNumber: record.requisitionNumber, reason });

      if (record.sequence !== expectedSequence) fail(VERIFICATION_FAILURE.SEQUENCE_GAP);
      if (record.prevHash !== expectedPrev) fail(VERIFICATION_FAILURE.CHAIN_BROKEN);
      const { recordHash, ...body } = record;
      if (computeRecordHash(body) !== recordHash) fail(VERIFICATION_FAILURE.HASH_MISMATCH);

      expectedSequence = record.sequence + 1;
      expectedPrev = record.recordHash;
    }
    return { valid: failures.length === 0, checked, failures };
  }

  /**
   * Applies one event to its draft, logs it, and seals if every required signal is present.
   * The draft write comes first and is idempotent, so a redelivery after a crash re-applies safely.
   */
  private async accumulate(
    meta: EventMeta,
    requisitionNumber: string,
    data: unknown,
    fields: Record<string, unknown>
  ): Promise<void> {
    const nowIso = this.now().toISOString();
    const outcome = await this.deps.drafts.apply(requisitionNumber, fields, meta.eventId, nowIso);

    await this.deps.events.append({ ...meta, requisitionNumber, data, recordedAt: nowIso });

    if (outcome === 'ALREADY_SEALED') {
      await this.quarantine(
        DEAD_LETTER_REASON.LATE_EVENT,
        meta.eventType,
        data,
        `Event ${meta.eventId} arrived after ${requisitionNumber} was sealed; the sealed record was not changed.`,
        { eventId: meta.eventId, requisitionNumber }
      );
      return;
    }

    await this.trySeal(requisitionNumber);
  }

  private async trySeal(requisitionNumber: string): Promise<void> {
    const draft = await this.deps.drafts.findByRequisition(requisitionNumber);
    if (!draft || draft.status === LEDGER_STATUS.SEALED) return;

    const missing = getMissingSignals(draft);
    if (missing.length > 0) {
      logger.info(`Transfer ${requisitionNumber} remains open; missing ${missing.join(', ')}`);
      return;
    }

    for (let attempt = 1; attempt <= MAX_SEQUENCE_ATTEMPTS; attempt++) {
      const last = await this.deps.sealed.findLast();
      const sealedAt = this.now().toISOString();
      const record = draftToSealedTransfer(draft, {
        sequence: (last?.sequence ?? 0) + 1,
        prevHash: last?.recordHash ?? GENESIS_HASH,
        sealedAt,
      });

      try {
        await this.deps.sealed.insert(record);
        await this.deps.drafts.markSealed(requisitionNumber, sealedAt);
        this.nudgeRenditions();
        logger.info(`Sealed transfer ${requisitionNumber} as sequence ${record.sequence}`);
        return;
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
        // A concurrent writer may have sealed this requisition or taken the sequence number.
        if (await this.deps.sealed.findByRequisition(requisitionNumber)) {
          await this.deps.drafts.markSealed(requisitionNumber, sealedAt);
          this.nudgeRenditions();
          return;
        }

      }
    }
    throw new Error(`Unable to allocate a ledger sequence for ${requisitionNumber}`);
  }

  private nudgeRenditions(): void {
    try {
      this.deps.onSealed?.();
    } catch (error) {
      logger.error(`Failed to nudge rendition reconciliation: ${error instanceof Error ? error.name : 'Unknown error'}`);
    }
  }
}
