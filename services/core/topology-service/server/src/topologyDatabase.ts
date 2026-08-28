// File: services/core/topology-service/src/topologyDatabase.ts

/* The graph database is the authoritative source for relationship validation in the compliance
gate described by ADR-003 and Section 3.1 of the ICD. The service boots a single Neo4j driver,
verifies connectivity, and seeds a minimal aviation relationship map so validation can operate
against a stable, testable topology during local development and container startup. */
import neo4j, { Driver } from 'neo4j-driver';
import { createLogger } from '@shared/telemetry';

const logger = createLogger('topology-service');

/* These values are sourced from the local service environment profile (for example, a sibling
.env file) and are deliberately split per ADR-006 so each service remains independently
deployable while the root compose file only stitches the shared platform network together. */
const DB_URI = process.env.DB_URI || 'bolt://localhost:7687';
const DB_USER = process.env.DB_USER || 'neo4j';
const DB_PASSWORD = process.env.DB_PASSWORD || 'password';

let driverInstance: Driver | null = null;

/**
 * Establishes the Neo4j driver and performs a retry/backoff loop while the graph container is
 * still booting. This protects startup from transient networking races without masking a real
 * failure once the retry budget is exhausted.
 */
export async function initializeDatabaseConnection(retries = 5, delayMs = 3000): Promise<Driver> {
  logger.info(`Attempting secure connection to graph infrastructure node at URI: [${DB_URI}]`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      /* Build a persistent driver with a bounded pool so the topology service remains resilient
      under multiple validation requests while still respecting the FMEA recommendation for
      connection-pool exhaustion controls. */
      driverInstance = neo4j.driver(DB_URI, neo4j.auth.basic(DB_USER, DB_PASSWORD), {
        maxConnectionPoolSize: 50,
        connectionTimeout: 5000
      });

      // Perform the actual server handshake before accepting the graph as healthy.
      await driverInstance.verifyConnectivity();
      logger.info('Successfully established connection to Neo4j graph cluster node.');

      /* Seed the minimal graph used by the authorization gate before the service starts handling
      real validation traffic. */
      await seedDefaultAviationGraphTopology();
      return driverInstance;
    } catch (caughtError: any) {
      logger.warn(`Database connection handshake failed (Attempt ${attempt}/${retries}): ${caughtError.message}`);

      if (driverInstance) {
        await driverInstance.close();
        driverInstance = null;
      }

      if (attempt === retries) {
        logger.error('Critical: Max graph database connection attempts exhausted. Aborting startup.');
        throw caughtError;
      }

      // Wait for the database container to finish its boot sequence before the next retry.
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Graph database connection pool initialization failed unexpectedly.');
}

/**
 * Returns the singleton driver used by the service. This keeps the connection lifecycle explicit
 * and avoids speculative duplicate clients being created while the gateway is answering calls.
 */
export function getDatabaseClient(): Driver {
  if (!driverInstance) {
    throw new Error('Database client invoked before connection initialization sequence completed.');
  }
  return driverInstance;
}

/**
 * Closes the active connection pool during shutdown so the container can exit cleanly and the
 * graph node is not left with an orphaned client session.
 */
export async function terminateDatabaseClient(): Promise<void> {
  if (driverInstance) {
    logger.info('Draining active graph database connection pool sockets safely...');
    await driverInstance.close();
    driverInstance = null;
    logger.info('Database socket pool drained cleanly.');
  }
}

/**
 * Seeds a minimal, deterministic aviation network that mirrors the initial compliance contract.
 * The structure is intentionally small: a small set of Asset nodes and AUTHORIZED_PATH edges that
 * allow the service to validate a known-safe clearance under local development conditions.
 *
 * In production this pattern is replaced by a richer, actual operational graph, but the seed is
 * valuable for one reason: it keeps the authorization flow testable and reviewable without a
 * complex data migration sequence.
 */
async function seedDefaultAviationGraphTopology(): Promise<void> {
  if (!driverInstance) return;

  const session = driverInstance.session();

  try {
    logger.info('Executing programmatic structural aviation node schema seeding checks...');

    /* The Asset.id property is treated as the canonical identity key for authorization decisions.
    Enforcing uniqueness here prevents duplicate graph nodes from creating ambiguous clearance
    checks during concurrent validation requests. */
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_asset_id IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE')
    );

    /* The seed data model intentionally mirrors the operating assumptions documented in the ICD:
    an aircraft can be linked to a destination airfield using a policy-specific context string. */
    const seedQueries = [
      {
        srcId: 'a3b48270-1283-4a11-bca9-593ef2718902',
        srcLabel: 'F-16 Eagle Flight Alpha',
        tgtId: 'f3b48270-1283-4a11-bca9-593ef2718902',
        tgtLabel: 'Forward Operating Base Alpha',
        context: 'SQUADRON_HANDOVER'
      },
      {
        srcId: 'b5c19381-2394-5b22-cdba-604fa3829013',
        srcLabel: 'C-17 Cargo Transporter',
        tgtId: 'e4c19381-2394-5b22-cdba-604fa3829013',
        tgtLabel: 'Logistics Airfield Bravo',
        context: 'CARGO_TRANSFER'
      }
    ];

    for (const data of seedQueries) {
      await session.executeWrite((tx) =>
        tx.run(
          `MERGE (src:Asset { id: $srcId })
           ON CREATE SET src.label = $srcLabel, src.type = 'AIRCRAFT'
           MERGE (tgt:Asset { id: $tgtId })
           ON CREATE SET tgt.label = $tgtLabel, tgt.type = 'AIRFIELD'
           MERGE (src)-[rel:AUTHORIZED_PATH { context: $context }]->(tgt)
           RETURN src, tgt, rel`,
          data
        )
      );
    }

    logger.info('Programmatic aviation graph seeding verification passed successfully.');
  } catch (error: any) {
    logger.error(`Critical failure encountered during programmatic graph seeding: ${error.message}`);
    throw error;
  } finally {
    /* Always close the session back to the driver pool. This keeps the service aligned with the
    connection lifecycle recommended by the FMEA and avoids leaking idle sessions. */
    await session.close();
  }
}
