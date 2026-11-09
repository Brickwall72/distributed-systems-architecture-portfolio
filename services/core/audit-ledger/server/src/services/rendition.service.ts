// File: services/core/audit-ledger/server/src/services/rendition.service.ts
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PDF_SUBJECTS, generatePdfCommandSchema } from '@contracts/pdf';
import { createLogger } from '@shared/express';
import type { EventBroker } from '@shared/messaging';
import { transferOverviewInputSchema } from '../registry/overview.schema';
import { renderTransferOverview } from '../registry/render-overview';
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
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.current = this.tick().catch((error: unknown) => {
        logger.error(`Rendition reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
      }).finally(() => {
        this.running = false;
        if (!this.stopped) {
          if (this.pending) { this.pending = false; this.nudge(); }
          else this.timer = setTimeout(() => this.nudge(), INTERVAL_MS);
        }
      });
    }, 0);
    this.running = true;
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
    let stage = 'load sealed source';
    try {
      const record = await this.sealed.findByRequisition(job.requisitionNumber);
      if (record?.sequence !== job.sequence || record?.recordHash !== job.sourceRecordHash) {
        throw new Error('Sealed source record not found or does not match rendition');
      }
      stage = 'project and render overview';
      const html = renderTransferOverview(transferOverviewInputSchema.parse(record));
      const command = generatePdfCommandSchema.parse({
        documentId: randomUUID(),
        documentName: 'transfer-overview',
        documentType: 'TRANSFER_OVERVIEW',
        requisitionNumber: record.requisitionNumber,
        customPath: `audit/transfers/${record.sequence}/overview-v${job.templateVersion}`,
        html,
      });
      stage = 'request PDF generation';
      const result = responseSchema.parse(await this.broker.request(PDF_SUBJECTS.GENERATE_PDF, command, { timeout: 45_000 }));
      if (result.storageKey !== `${command.customPath}/${command.documentId}.pdf`) {
        throw new Error('PDF storage key does not match the claimed attempt');
      }
      stage = 'save rendition metadata';
      const completed = await this.renditions.complete(job, {
        storageBucket: result.storageBucket, storageKey: result.storageKey, fileHash: result.fileHash,
      }, new Date());
      if (!completed) logger.warn(`Discarded expired rendition claim for sequence ${job.sequence}`);
    } catch (error) {
      const message = `${stage}: ${error instanceof Error ? error.name : 'Unknown error'}`;
      await this.renditions.fail(job, message, new Date());
      logger.error(`Rendition generation failed for sequence ${job.sequence}: ${message}`);
    }
  }
}
