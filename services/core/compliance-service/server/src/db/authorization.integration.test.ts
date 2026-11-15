// File: services/core/compliance-service/server/src/db/authorization.integration.test.ts
import type { Pool } from 'pg';

describe('compliance runtime PostgreSQL authorization', () => {
  let pool: Pool;
  let initDatabase: () => Promise<void>;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    const url = process.env.COMPLIANCE_RUNTIME_TEST_DATABASE_URL;
    if (!url) throw new Error('COMPLIANCE_RUNTIME_TEST_DATABASE_URL must point to an isolated restricted PostgreSQL database');
    process.env.DATABASE_URL = url;
    ({ pool } = await import('./pool'));
    ({ initDatabase } = await import('./initDatabase'));
  });

  afterAll(async () => {
    await pool?.end();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('initializes and upgrades the schema as a non-superuser', async () => {
    const result = await pool.query<{ rolname: string; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }>(
      'SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user',
    );
    expect(result.rows[0]).toMatchObject({
      rolname: 'integration_runtime', rolsuper: false, rolcreatedb: false, rolcreaterole: false,
    });
    await initDatabase();
    await initDatabase();
    const tables = await pool.query<{ count: string }>(
      "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user",
    );
    expect(Number(tables.rows[0].count)).toBeGreaterThanOrEqual(5);
  });

  it('cannot administer roles or create databases', async () => {
    await expect(pool.query('CREATE ROLE forbidden_test')).rejects.toMatchObject({ code: '42501' });
    await expect(pool.query('CREATE DATABASE forbidden_test')).rejects.toMatchObject({ code: '42501' });
  });
});
