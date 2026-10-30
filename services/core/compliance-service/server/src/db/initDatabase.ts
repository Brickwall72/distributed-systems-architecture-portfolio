// File: services/core/compliance-service/server/src/db/initDatabase.ts
import { pool } from './pool';
import { createLogger } from '@shared/express';

const logger = createLogger('compliance-db');

/**
 * Initializes the compliance database tables on server startup.
 */
export const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_documents (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL, -- Maps to formIdEnum (e.g., 'asset-transfer-authorization')
        type VARCHAR(30) NOT NULL DEFAULT 'AUTHORIZATION' CHECK (type IN ('AUTHORIZATION', 'RECEIPT')),
        transfer_type VARCHAR(30) NOT NULL DEFAULT 'PHYSICAL_TRANSFER' CHECK (transfer_type IN ('PHYSICAL_TRANSFER', 'C2_TRANSFER')),
        requisition_number VARCHAR(100) NOT NULL,
        storage_bucket VARCHAR(100) NOT NULL,
        storage_key TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING_SIGNATURE' CHECK (status IN ('SIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED')),
        signer_id VARCHAR(100) NOT NULL,
        transfer_event_id UUID, -- Foreign key link to your topology/transfer event graph
        file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the immutable PDF artifact for verification
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_compliance_docs_transfer ON compliance_documents(transfer_event_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_docs_status ON compliance_documents(status);
      CREATE INDEX IF NOT EXISTS idx_compliance_docs_created_at ON compliance_documents(created_at);
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