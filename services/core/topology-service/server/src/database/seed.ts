// File: services/core/topology-service/server/src/database/seed.ts
import { Driver } from 'neo4j-driver';
import { createLogger } from '@shared/express';

const logger = createLogger('topology-service');

/**
 * Seeds a comprehensive KSP custody network containing:
 * 1. Pristine assets with no transfer history.
 * 2. Multi-asset transfer events with partial completion states.
 * 3. Assets with multi-hop historical transfer trails over time.
 */
export async function seedSpaceCustodyGraphTopology(driver: Driver): Promise<void> {
  const session = driver.session();

  try {
    logger.info('Executing programmatic advanced KSP custody node schema seeding...');

    // Enforce constraints
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_asset_id IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE')
    );
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE')
    );
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_transfer_req IF NOT EXISTS FOR (e:TransferEvent) REQUIRE e.requisitionNumber IS UNIQUE')
    );
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_transfer_claim_document IF NOT EXISTS FOR (c:TransferClaim) REQUIRE c.documentId IS UNIQUE')
    );
    await session.executeWrite((tx) =>
      tx.run('CREATE CONSTRAINT idx_transfer_claim_req IF NOT EXISTS FOR (r:TransferClaimRequisition) REQUIRE r.requisitionNumber IS UNIQUE')
    );

    const advancedSeedQuery = `
      OPTIONAL MATCH (existing)
      WHERE existing:Organization OR existing:Asset OR existing:TransferEvent
      WITH count(existing) AS existingCount
      WHERE existingCount = 0

      // ==========================================
      // 1. ORGANIZATIONS
      // ==========================================
      MERGE (jeb:Organization { id: 'org-jeb-junkyard' })
        ON CREATE SET jeb.name = "Jebediah's Junkyard", jeb.type = 'CONTRACTOR', jeb.addressLine1 = 'Pad 39-B'
      
      MERGE (ksc:Organization { id: 'org-ksc-gov' })
        ON CREATE SET ksc.name = 'Kerbal Space Program (KSC)', ksc.type = 'GOV_AGENCY', ksc.addressLine1 = 'Launch Site Alpha'

      MERGE (rcs:Organization { id: 'org-reaction-engines' })
        ON CREATE SET rcs.name = 'Reaction Engines Ltd', rcs.type = 'CONTRACTOR', rcs.addressLine1 = 'Hangar 4'

      MERGE (deepspace:Organization { id: 'org-deepspace-network' })
        ON CREATE SET deepspace.name = 'Deep Space Tracking Corp', deepspace.type = 'CONTRACTOR', deepspace.addressLine1 = 'Mountain Station'

      // ==========================================
      // 2. PRISTINE ASSET (No transfer history)
      // ==========================================
      MERGE (pristineAsset:Asset { id: 'asset-pristine-probe' })
        ON CREATE SET 
          pristineAsset.name = 'Pristine Horizon Probe Mk I',
          pristineAsset.nomenclature = 'Horizon Probe Mk I',
          pristineAsset.serialNumber = 'KSP-PRISTINE-01',
          pristineAsset.type = 'PROBE',
          pristineAsset.controlType = 'REMOTE',
          pristineAsset.status = 'AVAILABLE'
      
      MERGE (jeb)-[:HAS_CUSTODY]->(pristineAsset)

      // ==========================================
      // 3. MULTI-ASSET TRANSFER EVENT (Partial Completion)
      // ==========================================
      MERGE (multiEvent:TransferEvent { requisitionNumber: 'REQ-KSP-MULTI-001' })
        ON CREATE SET 
          multiEvent.id = '10000000-0000-4000-8000-000000000001',
          multiEvent.date = '2026-09-15T00:00:00.000Z',
          multiEvent.type = 'PHYSICAL_TRANSFER',
          multiEvent.status = 'PARTIALLY_COMPLETED'

      MERGE (jeb)-[:DELIVERED_FROM]->(multiEvent)
      MERGE (multiEvent)-[:DELIVERED_TO]->(ksc)

      // Asset A in multi-transfer: COMPLETED (Custody with KSC)
      MERGE (assetA:Asset { id: 'asset-heavy-lifter-core' })
        ON CREATE SET 
          assetA.name = 'Mammoth Liquid Fuel Engine Cluster',
          assetA.nomenclature = 'Mammoth Engine Cluster',
          assetA.serialNumber = 'KSP-ENG-99',
          assetA.type = 'ENGINE',
          assetA.controlType = 'LOCAL',
          assetA.status = 'AVAILABLE'
      
      MERGE (multiEvent)-[:INVOLVES { itemNumber: '0001', status: 'COMPLETED' }]->(assetA)
      MERGE (ksc)-[:HAS_CUSTODY]->(assetA)

      // Asset B in multi-transfer: PENDING / IN-TRANSIT (Custody still with Jeb, locked)
      MERGE (assetB:Asset { id: 'asset-heavy-lifter-tanks' })
        ON CREATE SET 
          assetB.name = 'Jumbo-64 Fuel Tank Array',
          assetB.nomenclature = 'Jumbo-64 Tank',
          assetB.serialNumber = 'KSP-TNk-44',
          assetB.type = 'FUEL_TANK',
          assetB.controlType = 'LOCAL',
          assetB.status = 'IN_TRANSIT'
      
      MERGE (multiEvent)-[:INVOLVES { itemNumber: '0002', status: 'IN_TRANSIT' }]->(assetB)
      MERGE (jeb)-[:HAS_CUSTODY]->(assetB)

      // ==========================================
      // 4. HISTORICAL MULTI-HOP TRANSFER TRAIL
      // ==========================================
      MERGE (historicalAsset:Asset { id: 'asset-historical-rover' })
        ON CREATE SET 
          historicalAsset.name = 'Munar Survey Rover v1',
          historicalAsset.nomenclature = 'Munar Survey Rover',
          historicalAsset.serialNumber = 'KSP-ROV-HIST-01',
          historicalAsset.type = 'ROVER',
          historicalAsset.controlType = 'REMOTE',
          historicalAsset.status = 'AVAILABLE'

      // Hop 1: Reaction Engines -> Jeb's Junkyard (Past Event)
      MERGE (eventHop1:TransferEvent { requisitionNumber: 'REQ-KSP-HIST-001' })
        ON CREATE SET 
          eventHop1.id = '10000000-0000-4000-8000-000000000002',
          eventHop1.date = '2026-01-10T00:00:00.000Z',
          eventHop1.type = 'PHYSICAL_TRANSFER',
          eventHop1.status = 'COMPLETED'
      
      MERGE (rcs)-[:DELIVERED_FROM]->(eventHop1)
      MERGE (eventHop1)-[:DELIVERED_TO]->(jeb)
      MERGE (eventHop1)-[:INVOLVES { itemNumber: '0001', status: 'COMPLETED' }]->(historicalAsset)

      // Hop 2: Jeb's Junkyard -> KSC (Most Recent Completed Event)
      MERGE (eventHop2:TransferEvent { requisitionNumber: 'REQ-KSP-HIST-002' })
        ON CREATE SET 
          eventHop2.id = '10000000-0000-4000-8000-000000000003',
          eventHop2.date = '2026-08-01T00:00:00.000Z',
          eventHop2.type = 'PHYSICAL_TRANSFER',
          eventHop2.status = 'COMPLETED'
      
      MERGE (jeb)-[:DELIVERED_FROM]->(eventHop2)
      MERGE (eventHop2)-[:DELIVERED_TO]->(ksc)
      MERGE (eventHop2)-[:INVOLVES { itemNumber: '0001', status: 'COMPLETED' }]->(historicalAsset)

      // Current active custody rests with KSC
      MERGE (ksc)-[:HAS_CUSTODY]->(historicalAsset)
    `;

    await session.executeWrite((tx) => tx.run(advancedSeedQuery));

    logger.info('Advanced KSP custody graph seeding completed successfully.');
  } catch (error: any) {
    logger.error(`Critical failure during advanced graph seeding: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
}