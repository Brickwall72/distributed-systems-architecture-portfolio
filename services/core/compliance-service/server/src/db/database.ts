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
        document_type VARCHAR(100) NOT NULL,
        s3_uri TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
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