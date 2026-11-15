// File: services/core/topology-service/server/src/database/seed.ts
import { Driver } from 'neo4j-driver';
import { createLogger } from '@shared/express';

const logger = createLogger('topology-service');

const organizations = [
  { id: 'org-jeb-junkyard', name: "Jebediah's Junkyard", type: 'CONTRACTOR', addressLine1: 'Pad 39-B' },
  { id: 'org-ksc-gov', name: 'Kerbal Space Program (KSC)', type: 'GOV_AGENCY', addressLine1: 'Launch Site Alpha' },
  { id: 'org-reaction-engines', name: 'Reaction Engines Ltd', type: 'CONTRACTOR', addressLine1: 'Hangar 4' },
  { id: 'org-deepspace-network', name: 'Deep Space Tracking Corp', type: 'CONTRACTOR', addressLine1: 'Mountain Station' },
];

const assets = [
  { id: 'asset-pristine-probe', name: 'Pristine Horizon Probe Mk I', nomenclature: 'Horizon Probe Mk I', serialNumber: 'KSP-PRISTINE-01', type: 'PROBE', controlType: 'REMOTE', owner: 'org-jeb-junkyard' },
  { id: 'asset-heavy-lifter-core', name: 'Mammoth Liquid Fuel Engine Cluster', nomenclature: 'Mammoth Engine Cluster', serialNumber: 'KSP-ENG-99', type: 'ENGINE', controlType: 'LOCAL', owner: 'org-ksc-gov' },
  { id: 'asset-heavy-lifter-tanks', name: 'Jumbo-64 Fuel Tank Array', nomenclature: 'Jumbo-64 Tank', serialNumber: 'KSP-TNk-44', type: 'FUEL_TANK', controlType: 'LOCAL', owner: 'org-jeb-junkyard' },
  { id: 'asset-historical-rover', name: 'Munar Survey Rover v1', nomenclature: 'Munar Survey Rover', serialNumber: 'KSP-ROV-HIST-01', type: 'ROVER', controlType: 'REMOTE', owner: 'org-ksc-gov' },
  { id: 'asset-orbit-relay', name: 'Orbital Relay Probe', nomenclature: 'Relay Probe', serialNumber: 'KSP-PRB-02', type: 'PROBE', controlType: 'REMOTE', owner: 'org-deepspace-network' },
  { id: 'asset-tracking-antenna', name: 'Deep Space Tracking Antenna', nomenclature: 'Tracking Antenna', serialNumber: 'KSP-ANT-03', type: 'ANTENNA', controlType: 'LOCAL', owner: 'org-deepspace-network' },
  { id: 'asset-lander-cabin', name: 'Munar Lander Cabin', nomenclature: 'Lander Cabin', serialNumber: 'KSP-CAB-04', type: 'CABIN', controlType: 'LOCAL', owner: 'org-ksc-gov' },
  { id: 'asset-return-capsule', name: 'Reentry Capsule', nomenclature: 'Return Capsule', serialNumber: 'KSP-CAP-05', type: 'CAPSULE', controlType: 'LOCAL', owner: 'org-ksc-gov' },
  { id: 'asset-maneuver-engine', name: 'Orbital Maneuvering Engine', nomenclature: 'Maneuver Engine', serialNumber: 'KSP-ENG-06', type: 'ENGINE', controlType: 'LOCAL', owner: 'org-reaction-engines' },
  { id: 'asset-fuel-module', name: 'Orbital Fuel Module', nomenclature: 'Fuel Module', serialNumber: 'KSP-TNK-07', type: 'FUEL_TANK', controlType: 'LOCAL', owner: 'org-reaction-engines' },
  { id: 'asset-survey-rover', name: 'Surface Survey Rover', nomenclature: 'Survey Rover', serialNumber: 'KSP-ROV-08', type: 'ROVER', controlType: 'REMOTE', owner: 'org-jeb-junkyard' },
  { id: 'asset-navigation-probe', name: 'Navigation Test Probe', nomenclature: 'Navigation Probe', serialNumber: 'KSP-PRB-09', type: 'PROBE', controlType: 'REMOTE', owner: 'org-reaction-engines' },
];

export async function seedSpaceCustodyGraphTopology(driver: Driver): Promise<void> {
  const session = driver.session();
  try {
    logger.info('Initializing topology constraints and clean fictional asset inventory.');
    const constraints = [
      'CREATE CONSTRAINT idx_asset_id IF NOT EXISTS FOR (a:Asset) REQUIRE a.id IS UNIQUE',
      'CREATE CONSTRAINT idx_org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE',
      'CREATE CONSTRAINT idx_transfer_req IF NOT EXISTS FOR (e:TransferEvent) REQUIRE e.requisitionNumber IS UNIQUE',
      'CREATE CONSTRAINT idx_transfer_claim_document IF NOT EXISTS FOR (c:TransferClaim) REQUIRE c.documentId IS UNIQUE',
      'CREATE CONSTRAINT idx_transfer_claim_req IF NOT EXISTS FOR (r:TransferClaimRequisition) REQUIRE r.requisitionNumber IS UNIQUE',
    ];
    await constraints.reduce<Promise<unknown>>(
      (chain, constraint) => chain.then(() => session.executeWrite((tx) => tx.run(constraint))),
      Promise.resolve(),
    );

    await session.executeWrite((tx) => tx.run(`
      OPTIONAL MATCH (existing)
      WHERE existing:Organization OR existing:Asset OR existing:TransferEvent
      WITH count(existing) AS existingCount
      WHERE existingCount = 0
      UNWIND $organizations AS org
      CREATE (:Organization {id: org.id, name: org.name, type: org.type, addressLine1: org.addressLine1})
      WITH count(*) AS created
      WHERE created > 0
      UNWIND $assets AS item
      MATCH (owner:Organization {id: item.owner})
      CREATE (asset:Asset {id: item.id, name: item.name, nomenclature: item.nomenclature,
        serialNumber: item.serialNumber, type: item.type, controlType: item.controlType, status: 'AVAILABLE'})
      CREATE (owner)-[:HAS_CUSTODY]->(asset)
    `, { organizations, assets }));
    logger.info('Fictional topology seed initialization completed.');
  } catch (error: unknown) {
    logger.error(`Critical failure during graph seeding: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    await session.close();
  }
}
