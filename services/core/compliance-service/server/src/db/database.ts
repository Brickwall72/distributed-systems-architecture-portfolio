// File: services/core/compliance-service/server/src/db/database.ts
import pkg from 'pg';
import { createLogger } from '@shared/telemetry';

const { Pool } = pkg;
const logger = createLogger('compliance-db');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@compliance-db:5432/compliance',
});

/**
 * Initializes the compliance database tables on server startup.
 */
export const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS compliance_documents (
        id UUID PRIMARY KEY,
        document_type VARCHAR(100) NOT NULL,
        s3_uri TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Compliance database schema initialized successfully.');
  } catch (error) {
    logger.error(`Failed to initialize database schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};