// File: services/core/compliance-service/server/src/db/pool.ts
import pkg from 'pg';

const { Pool, types } = pkg;

// OID 1114: timestamp without time zone
// Appends 'Z' to treat naive database timestamps as UTC and converts to ISO string
types.setTypeParser(types.builtins.TIMESTAMP, (val: string) => {
  if (val === null) return null;
  return new Date(`${val}Z`).toISOString();
});

// OID 1184: timestamp with time zone (timestamptz)
// Converts timezone-aware timestamps directly into standardized ISO strings
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val: string) => {
  if (val === null) return null;
  return new Date(val).toISOString();
});

// Explicit config object prevents building invalid connection strings if env vars are missing
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