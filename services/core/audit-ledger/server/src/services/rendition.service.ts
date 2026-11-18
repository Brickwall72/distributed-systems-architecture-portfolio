// File: services/core/audit-ledger/server/src/services/rendition.service.ts
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PDF_SUBJECTS, generatePdfCommandSchema } from '@contracts/pdf';
import {
  createLogger, runInNewDiagnosticContext, runOperation, safeErrorMetadata, withoutDiagnosticContext,
  type OperationOutcome,
} from '@shared/express';
import type { EventBroker } from '@shared/messaging';
import { transferOverviewInputSchema, renderTransferOverview } from '../registry';
import type { RenditionsRepository, SealedTransfersRepository, Rendition } from '../repositories';

const logger = createLogger('audit-server:renditions');
const responseSchema = z.object({
  success: z.literal(true),
  storageBucket: z.string().min(1),
  storageKey: z.string().min(1),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i),
});
const SCAN_SIZE = 100;
const LEASE_MS = 60_000;
const INTERVAL_MS = 5_000;

export class RenditionService {
  private cursor = 0;
  private nextFullScan = 0;
  private sweepInProgress = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private stopped = true;
  private pending = false;
  private current: Promise<void> | undefined;

  constructor(
    private readonly sealed: SealedTransfersRepository,
    private readonly renditions: RenditionsRepository,
    private readonly broker: EventBroker,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.nudge();
  }

  nudge(): void {
    if (this.stopped) return;
    if (this.running) { this.pending = true; return; }
    if (this.timer) clearTimeout(this.timer);
    this.running = true;
    this.schedule(0);
  }

  private schedule(delay: number): void {
    this.timer = withoutDiagnosticContext(() => setTimeout(() => this.runScheduledTick(), delay));
  }

  private runScheduledTick(): void {
    this.timer = undefined;
    this.current = this.tick()
      .catch((error: unknown) => logger.error('Rendition reconciliation failed', undefined, safeErrorMetadata(error)))
      .finally(() => this.finishTick());
  }

  private finishTick(): void {
    this.running = false;
    if (this.stopped) return;
    if (this.pending) {
      this.pending = false;
      this.nudge();
      return;
    }
    this.schedule(INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.current;
    this.running = false;
    this.pending = false;
  }

  async tick(): Promise<void> {
    if (!this.sweepInProgress && Date.now() >= this.nextFullScan) {
      this.cursor = 0;
      this.sweepInProgress = true;
    }
    const records = await this.sealed.listAfter(this.cursor, SCAN_SIZE);
    await Promise.all(records.map((record) => this.renditions.ensure(record)));
    const lastRecord = records.at(-1);
    if (lastRecord) this.cursor = lastRecord.sequence;
    if (records.length === SCAN_SIZE) {
      this.sweepInProgress = true;
    } else if (this.sweepInProgress) {
      this.sweepInProgress = false;
      this.nextFullScan = Date.now() + 60_000;
    }
    const job = await this.renditions.claim(new Date(), LEASE_MS);
    if (job) await this.process(job);
    if (records.length === SCAN_SIZE || job) this.pending = true;
  }

  private async process(job: Rendition): Promise<void> {
    await runInNewDiagnosticContext(() => runOperation(logger, 'audit.rendition.attempt', async (): Promise<OperationOutcome> => {
      let stage = 'load sealed source';
      try {
        const record = await runOperation(logger, 'audit.rendition.source', async () => {
          const source = await this.sealed.findByRequisition(job.requisitionNumber);
          if (source?.sequence !== job.sequence || source?.recordHash !== job.sourceRecordHash) {
            throw new Error('Sealed source record not found or does not match rendition');
          }
          return source;
        });
        stage = 'project and render overview';
        const html = await runOperation(logger, 'audit.rendition.render', async () =>
          renderTransferOverview(transferOverviewInputSchema.parse(record)));
        const command = generatePdfCommandSchema.parse({
          documentId: randomUUID(),
          documentName: 'transfer-overview',
          documentType: 'TRANSFER_OVERVIEW',
          requisitionNumber: record.requisitionNumber,
          customPath: `audit/transfers/${record.sequence}/overview-v${job.templateVersion}`,
          html,
        });
        stage = 'request PDF generation';
        const result = await runOperation(logger, 'audit.rendition.pdf', async () => {
          const response = responseSchema.parse(await this.broker.request(PDF_SUBJECTS.GENERATE_AUDIT_PDF, command, { timeout: 45_000 }));
          if (response.storageKey !== `${command.customPath}/${command.documentId}.pdf`) {
            throw new Error('PDF storage key does not match the claimed attempt');
          }
          return response;
        });
        stage = 'save rendition metadata';
        const completed = await runOperation(logger, 'audit.rendition.persist', () => this.renditions.complete(job, {
          storageBucket: result.storageBucket, storageKey: result.storageKey, fileHash: result.fileHash,
        }, new Date()), { classify: (saved) => saved ? 'success' : 'discarded' });
        if (!completed) logger.warn(`Discarded expired rendition claim for sequence ${job.sequence}`);
        return completed ? 'success' : 'discarded';
      } catch (error) {
        const message = `${stage}: ${error instanceof Error ? error.name : 'Unknown error'}`;
        await this.renditions.fail(job, message, new Date());
        logger.error(`Rendition generation failed during ${stage}`, undefined, {
          sequence: job.sequence, ...safeErrorMetadata(error),
        });
        return 'failure';
      }
    }, { metadata: { sequence: job.sequence }, classify: (outcome) => outcome }));
  }
}
