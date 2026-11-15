// File: services/core/topology-service/server/src/database/seed.integration.test.ts
import neo4j, { type Driver } from 'neo4j-driver';
import { seedSpaceCustodyGraphTopology } from './seed';

const uri = process.env.SEED_TEST_NEO4J_URI;

describe('fresh topology seed with Neo4j', () => {
  let driver: Driver;

  beforeAll(async () => {
    if (!uri) throw new Error('SEED_TEST_NEO4J_URI must point to an empty isolated database');
    driver = neo4j.driver(uri);
    await driver.verifyConnectivity();
    const session = driver.session();
    try {
      const result = await session.run('MATCH (n) RETURN count(n) AS count');
      if (result.records[0].get('count').toNumber() !== 0) {
        throw new Error('Seed integration test requires an empty database');
      }
    } finally {
      await session.close();
    }
    await seedSpaceCustodyGraphTopology(driver);
  }, 30000);

  afterAll(async () => {
    await driver?.close();
  });

  it('creates an available inventory with one custodian each and no history', async () => {
    const session = driver.session();
    try {
      const result = await session.run(`
        MATCH (asset:Asset)
        OPTIONAL MATCH (owner:Organization)-[:HAS_CUSTODY]->(asset)
        RETURN asset.id AS id, asset.status AS status, collect(owner.id) AS owners
      `);
      expect(result.records.length).toBeGreaterThanOrEqual(12);
      for (const record of result.records) {
        expect(record.get('status')).toBe('AVAILABLE');
        expect(record.get('owners')).toHaveLength(1);
      }
      const history = await session.run('MATCH (n) WHERE n:TransferEvent OR n:TransferClaim RETURN count(n) AS count');
      expect(history.records[0].get('count').toNumber()).toBe(0);
      await session.run(`
        MATCH (:Organization {id: 'org-jeb-junkyard'})-[custody:HAS_CUSTODY]->(asset:Asset {id: 'asset-heavy-lifter-tanks'})
        MATCH (newOwner:Organization {id: 'org-ksc-gov'})
        DELETE custody
        CREATE (newOwner)-[:HAS_CUSTODY]->(asset)
      `);
    } finally {
      await session.close();
    }
    await seedSpaceCustodyGraphTopology(driver);
    const check = driver.session();
    try {
      const result = await check.run(`
        MATCH (owner:Organization)-[:HAS_CUSTODY]->(:Asset {id: 'asset-heavy-lifter-tanks'})
        RETURN collect(owner.id) AS owners
      `);
      expect(result.records[0].get('owners')).toEqual(['org-ksc-gov']);
    } finally {
      await check.close();
    }
  }, 30000);
});
