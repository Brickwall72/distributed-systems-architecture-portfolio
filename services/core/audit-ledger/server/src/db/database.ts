// File: services/core/audit-ledger/server/src/db/database.ts
import { MongoClient, Db } from 'mongodb';
import { createLogger } from '@shared/express';
import { env } from '../config';
import { ensureIndexes } from './indexes';

const logger = createLogger('audit-database');

let client: MongoClient | null = null;
let db: Db | null = null;

function buildUri(): string {
  const credentials = env.DB_USER
    ? `${encodeURIComponent(env.DB_USER)}:${encodeURIComponent(env.DB_PASSWORD ?? '')}@`
    : '';
  const authSource = env.DB_USER ? `?authSource=${encodeURIComponent(env.DB_AUTH_SOURCE)}` : '';
  return `mongodb://${credentials}${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}${authSource}`;
}

/** Connects once and reuses the handle; throws so the caller decides how to fail. */
export async function connectDatabase(): Promise<Db> {
  if (db) return db;

  const candidate = new MongoClient(buildUri(), {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
  });

  try {
    await candidate.connect();
    const handle = candidate.db(env.DB_NAME);
    await handle.command({ ping: 1 });
    await ensureIndexes(handle);
    client = candidate;
    db = handle;
    logger.info('Connected to MongoDB audit ledger.');
    return handle;
  } catch (error) {
    await candidate.close().catch(() => undefined);
    throw error;
  }
}

export async function connectDatabaseWithRetry(retries = 10, delayMs = 3000): Promise<Db> {
  const attemptConnection = async (attempt: number): Promise<Db> => {
    try {
      return await connectDatabase();
    } catch (error) {
      if (attempt >= retries) throw error;
      logger.warn(`MongoDB not ready (attempt ${attempt}/${retries}): ${error instanceof Error ? error.message : error}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return attemptConnection(attempt + 1);
    }
  };

  return attemptConnection(1);
}

export async function closeDatabase(): Promise<void> {
  if (!client) return;
  await client.close();
  client = null;
  db = null;
  logger.info('MongoDB connection closed.');
}
