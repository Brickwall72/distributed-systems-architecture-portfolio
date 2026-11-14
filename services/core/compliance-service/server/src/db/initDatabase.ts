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
        status VARCHAR(30) NOT NULL DEFAULT 'SIGNED' CHECK (status IN ('SIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED')),
        topology_application_status VARCHAR(30) NOT NULL DEFAULT 'APPLIED'
          CHECK (topology_application_status IN ('PENDING', 'APPLIED', 'ATTENTION_REQUIRED')),
        topology_pending_at TIMESTAMPTZ,
        signer_id VARCHAR(100) NOT NULL,
        transfer_event_id UUID, -- Foreign key link to your topology/transfer event graph
        file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the immutable PDF artifact for verification
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS topology_application_status VARCHAR(30) NOT NULL DEFAULT 'APPLIED';
      ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS topology_pending_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_compliance_docs_transfer ON compliance_documents(transfer_event_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_docs_status ON compliance_documents(status);
      CREATE INDEX IF NOT EXISTS idx_compliance_docs_created_at ON compliance_documents(created_at);

      CREATE TABLE IF NOT EXISTS compliance_transfer_participants (
        requisition_number VARCHAR(100) PRIMARY KEY,
        transfer_event_id UUID UNIQUE NOT NULL,
        sender_org_id TEXT NOT NULL CHECK (sender_org_id <> ''),
        receiver_org_id TEXT NOT NULL CHECK (receiver_org_id <> '')
      );

      CREATE TABLE IF NOT EXISTS compliance_draft_bindings (
        document_id UUID PRIMARY KEY,
        creator_id TEXT NOT NULL,
        creator_org_id TEXT NOT NULL,
        binding JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS compliance_signing_operations (
        document_id UUID PRIMARY KEY,
        request_hash TEXT NOT NULL,
        claim JSONB NOT NULL,
        command JSONB,
        state TEXT NOT NULL CHECK (state IN ('PENDING', 'SIGNED', 'COMPLETED', 'CONFLICT')),
        signed_result JSONB,
        lease_id UUID,
        lease_until TIMESTAMPTZ,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_error_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_compliance_signing_pending
        ON compliance_signing_operations (state, next_attempt_at);

      CREATE TABLE IF NOT EXISTS compliance_signed_outbox (
        event_id TEXT PRIMARY KEY,
        document_id UUID NOT NULL REFERENCES compliance_signing_operations(document_id),
        subject TEXT NOT NULL,
        payload JSONB NOT NULL,
        published_at TIMESTAMPTZ,
        lease_id UUID,
        lease_until TIMESTAMPTZ,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_compliance_signed_outbox_pending
        ON compliance_signed_outbox (next_attempt_at) WHERE published_at IS NULL;
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

export async function initializeDatabaseWithRetry(attempt = 1): Promise<void> {
  try {
    await initDatabase();
  } catch (dbErr) {
    if (attempt >= 5) throw dbErr;
    logger.warn(`Database not ready (attempt ${attempt}/5). Retrying...`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    return initializeDatabaseWithRetry(attempt + 1);
  }
}