// File: services/core/topology-service/src/topologyDatabase.ts

/* The graph database is the authoritative source for relationship validation in the compliance
gate described by ADR-003 and Section 3.1 of the ICD. The service boots a single Neo4j driver,
verifies connectivity, and seeds a minimal space custody relationship map so validation can operate
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
      await seedSpaceCustodyGraphTopology();
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
 * Seeds a minimal, deterministic space custody network that mirrors the initial compliance contract.
 * The structure maps Organizations, TransferEvents (DD-1149), and Assets.
 */
async function seedSpaceCustodyGraphTopology(): Promise<void> {
  if (!driverInstance) return;

  const session = driverInstance.session();

  try {
    logger.info('Executing programmatic space custody node schema seeding checks...');

    // 1. Enforce constraints for reliable lookups and performance
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_asset_id IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE')
    );
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE')
    );
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_transfer_req IF NOT EXISTS FOR (e:TransferEvent) REQUIRE e.requisitionNumber IS UNIQUE')
    );

    // 2. Define the seed data matching all expected query parameters ($fromOrg, $toOrg, $asset, $transferData)
    const seedData = {
      fromOrg: {
        id: 'org-1111-lockheed',
        name: 'Lockheed Martin Space',
        address1: '1111 Lockheed Martin Way',
        address2: 'Sunnyvale, CA 94089'
      },
      toOrg: {
        id: 'org-2222-ussf',
        name: 'Space Systems Command (USSF)',
        address1: 'Los Angeles Air Force Base',
        address2: 'El Segundo, CA 90245'
      },
      asset: {
        id: 'asset-3333-gps3',
        nomenclature: 'GPS III Space Vehicle 11',
        serialNumber: 'GPS-III-SV11-001'
      },
      transferData: {
        requisitionNumber: 'REQ-2026-SSC-0092',
        date: '20260904'
      }
    };

    const query: string = `
      // 1. Create Organizations with types
      MERGE (sender:Organization { id: $fromOrg.id })
        ON CREATE SET 
          sender.name = $fromOrg.name, 
          sender.type = 'CONTRACTOR',
          sender.address1 = $fromOrg.address1, 
          sender.address2 = $fromOrg.address2
      
      MERGE (receiver:Organization { id: $toOrg.id })
        ON CREATE SET 
          receiver.name = $toOrg.name, 
          receiver.type = 'MILITARY_BRANCH',
          receiver.address1 = $toOrg.address1, 
          receiver.address2 = $toOrg.address2
      
      // 2. Create Asset with nomenclature properties
      MERGE (a:Asset { id: $asset.id })
        ON CREATE SET 
          a.name = $asset.nomenclature, 
          a.nomenclature = $asset.nomenclature, 
          a.serialNumber = $asset.serialNumber, 
          a.type = 'SATELLITE'
      
      // 3. Create the Transfer Event with explicit requisitionNumber property for gateway matching
      MERGE (event:TransferEvent { requisitionNumber: $transferData.requisitionNumber })
        ON CREATE SET 
          event.id = $transferData.requisitionNumber,
          event.date = $transferData.date
      
      // 4. Link organizations and assets to the transfer event
      MERGE (sender)-[:INITIATED]->(event)
      MERGE (event)-[:DELIVERED_TO]->(receiver)
      
      // Store line-item specific data on the INVOLVES edge
      MERGE (event)-[inv:INVOLVES { assetId: a.id }]->(a)
        ON CREATE SET inv.quantity = 1, inv.unit = 'EA', inv.itemNumber = '0001'
      
      // 5. Update current operational custody state
      MERGE (sender)-[:HAS_CUSTODY]->(a)
    `;

    await session.executeWrite((tx) => tx.run(query, seedData));

    logger.info('Programmatic space custody graph seeding verification passed successfully.');
  } catch (error: any) {
    logger.error(`Critical failure encountered during programmatic graph seeding: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
}

export { seedSpaceCustodyGraphTopology };