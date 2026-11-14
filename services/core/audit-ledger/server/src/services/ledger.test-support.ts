// File: services/core/audit-ledger/server/src/services/ledger.test-support.ts
import { LEDGER_STATUS, type DeadLetter, type SealedTransfer } from 'audit-shared';
import { transferDraftEntitySchema, type EventLogEntity, type TransferDraftEntity } from '../domain';
import { LedgerService } from './ledger.service';
import type {
  AccessScope,
  DeadLettersRepository,
  DraftsRepository,
  EventsRepository,
  SealedTransfersRepository,
} from '../repositories';

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    cursor[key] = (cursor[key] as Record<string, unknown>) ?? {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys.at(-1)!] = structuredClone(value);
}

/** In-memory stand-ins mirroring the Mongo repositories' semantics (idempotent merge, insert-only seals). */
export function createInMemoryLedger(now: () => Date = () => new Date('2025-01-01T00:00:00.000Z')) {
  const eventLog = new Map<string, EventLogEntity>();
  const drafts = new Map<string, Record<string, unknown>>();
  const sealed: SealedTransfer[] = [];
  const deadLetters: DeadLetter[] = [];

  async function* generate() {
    await Promise.resolve();
    for (const record of sealed) {
      yield structuredClone(record);
    }
  }

  const events = {
    append(entry: EventLogEntity): Promise<void> {
      if (!eventLog.has(entry.eventId)) eventLog.set(entry.eventId, entry);
      return Promise.resolve();
    },
  } as unknown as EventsRepository;

  const draftsRepo = {
    findByRequisition(requisitionNumber: string): Promise<TransferDraftEntity | null> {
      const doc = drafts.get(requisitionNumber);
      return Promise.resolve(doc ? transferDraftEntitySchema.parse(structuredClone(doc)) : null);
    },
    apply(requisitionNumber: string, fields: Record<string, unknown>, eventId: string, at: string) {
      let doc = drafts.get(requisitionNumber);
      if (doc?.status === LEDGER_STATUS.SEALED) return Promise.resolve('ALREADY_SEALED' as const);
      if (!doc) {
        doc = { requisitionNumber, status: LEDGER_STATUS.OPEN, createdAt: at, eventIds: [] };
        drafts.set(requisitionNumber, doc);
      }
      for (const [path, value] of Object.entries(fields)) setPath(doc, path, value);
      doc.updatedAt = at;
      const ids = doc.eventIds as string[];
      if (!ids.includes(eventId)) ids.push(eventId);
      return Promise.resolve('APPLIED' as const);
    },
    markSealed(requisitionNumber: string, at: string): Promise<void> {
      const doc = drafts.get(requisitionNumber);
      if (doc) Object.assign(doc, { status: LEDGER_STATUS.SEALED, updatedAt: at });
      return Promise.resolve();
    },
    list(status: string | undefined, limit: number, offset: number, scope: AccessScope): Promise<TransferDraftEntity[]> {
      return Promise.resolve(
        [...drafts.values()]
          .filter((d) => !status || d.status === status)
          .map((d) => transferDraftEntitySchema.parse(structuredClone(d))),
      ).then((items) => items.filter((d) => scope.kind === 'auditor'
        || (Boolean(d.sender?.id) && Boolean(d.receiver?.id) && (d.sender?.id === scope.orgId || d.receiver?.id === scope.orgId)))
        .slice(offset, offset + limit));
    },
  } as unknown as DraftsRepository;

  const sealedRepo = {
    insert(record: SealedTransfer): Promise<void> {
      if (sealed.some((r) => r.sequence === record.sequence || r.requisitionNumber === record.requisitionNumber)) {
        const err = new Error('E11000 duplicate key');
        (err as { code?: number }).code = 11000;
        return Promise.reject(err);
      }
      sealed.push(structuredClone(record));
      return Promise.resolve();
    },
    findLast() {
      return Promise.resolve(sealed.length ? structuredClone(sealed.at(-1)!) : null);
    },
    findByRequisition(requisitionNumber: string) {
      const found = sealed.find((r) => r.requisitionNumber === requisitionNumber);
      return Promise.resolve(found ? structuredClone(found) : null);
    },
    list(limit: number, offset: number, scope: AccessScope) {
      return Promise.resolve([...sealed].reverse()
        .filter((record) => scope.kind === 'auditor' || record.sender.id === scope.orgId || record.receiver.id === scope.orgId)
        .slice(offset, offset + limit));
    },
    iterateInOrder() {
      return generate();
    },
  } as unknown as SealedTransfersRepository;

  const deadLettersRepo = {
    add(entry: DeadLetter): Promise<void> {
      deadLetters.push(entry);
      return Promise.resolve();
    },
    list() {
      return Promise.resolve([...deadLetters]);
    },
  } as unknown as DeadLettersRepository;

  const service = new LedgerService({ events, drafts: draftsRepo, sealed: sealedRepo, deadLetters: deadLettersRepo, now });
  return { service, eventLog, drafts, sealed, deadLetters };
}
