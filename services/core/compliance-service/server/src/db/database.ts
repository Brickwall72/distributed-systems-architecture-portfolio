// File: services/core/compliance-service/server/src/db/database.ts
import pkg from 'pg';
import { createLogger } from '@shared/express';

const { Pool, types } = pkg;
const logger = createLogger('compliance-db');

// Force node-postgres to return TIMESTAMP (1114) and TIMESTAMPTZ (1184) as raw strings
// instead of instantiating JS Date objects. This satisfies Zod string contract validations.
types.setTypeParser(1114, (val: string) => val);
types.setTypeParser(1184, (val: string) => val);

// Explicit config object prevents building invalid 'postgresql://undefined:undefined@...' strings if env vars are missing
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'compliance-db',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.POSTGRES_DB || process.env.DB_NAME,
      }
);

/**
 * Initializes the compliance database tables on server startup.
 */
export const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_documents (
        id UUID PRIMARY KEY,
        document_type VARCHAR(100) NOT NULL, -- Maps to TemplateIdSchema (e.g., 'asset-transfer-authorization')
        bucket VARCHAR(100) NOT NULL,
        object_key TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING_SIGNATURE' CHECK (status IN ('PENDING_SIGNATURE', 'SIGNED', 'REJECTED', 'SUPERSEDED')),
        signer_id VARCHAR(100),
        entity_id VARCHAR(100),
        transfer_event_id UUID, -- Foreign key link to your topology/transfer event graph
        document_hash VARCHAR(64), -- SHA-256 hash of the immutable PDF artifact for verification
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_compliance_docs_transfer ON compliance_documents(transfer_event_id);
      CREATE INDEX idx_compliance_docs_status ON compliance_documents(status);
      CREATE INDEX idx_compliance_docs_created_at ON compliance_documents(created_at);
    `);
    logger.info('Compliance database schema initialized successfully.');
  } catch (error) {
    logger.error(
      `Failed to initialize database schema: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    throw error;
  }
};