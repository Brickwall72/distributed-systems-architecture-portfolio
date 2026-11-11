// File: services/core/topology-service/server/src/repositories/graph/graph.repository.integration.test.ts
import { randomUUID } from 'node:crypto';
import neo4j, { type Driver } from 'neo4j-driver';
import type { NetworkCanvasInput } from '@contracts/topology';
import { GraphRepository } from './graph.repository';

const uri = process.env.GRAPH_TEST_NEO4J_URI;

describe('GraphRepository with Neo4j', () => {
  const runId = `graph-test-${randomUUID()}-`;
  const id = (value: string) => `${runId}${value}`;
  let driver: Driver;
  let repository: GraphRepository;

  const filters = (overrides: Partial<NetworkCanvasInput> = {}): NetworkCanvasInput => ({
    whitelistSenders: [],
    whitelistReceivers: [],
    whitelistAssets: [],
    whitelistTransfers: [],
    includeCompletedTransferEvents: false,
    ...overrides,
  });

  beforeAll(async () => {
    if (!uri) throw new Error('GRAPH_TEST_NEO4J_URI must point to an isolated test database');
    driver = neo4j.driver(uri);
    await driver.verifyConnectivity();
    repository = new GraphRepository(driver);
    const session = driver.session();
    try {
      await session.run(`
        CREATE (a:Organization {id: $a, name: 'A', testRunId: $runId}),
               (b:Organization {id: $b, name: 'B', testRunId: $runId}),
               (c:Organization {id: $c, name: 'C', testRunId: $runId}),
               (d:Organization {id: $d, name: 'D', testRunId: $runId}),
               (:Organization {id: $unrelated, name: 'Unrelated', testRunId: $runId}),
               (outAsset:Asset {id: $outAsset, status: 'IN_TRANSIT', testRunId: $runId}),
               (inAsset:Asset {id: $inAsset, status: 'IN_TRANSIT', testRunId: $runId}),
               (oldAsset:Asset {id: $oldAsset, status: 'AVAILABLE', testRunId: $runId}),
               (custodyAsset:Asset {id: $custodyAsset, status: 'AVAILABLE', testRunId: $runId}),
               (out:TransferEvent {id: $out, requisitionNumber: $out, status: 'IN_PROGRESS', testRunId: $runId}),
               (incoming:TransferEvent {id: $incoming, requisitionNumber: $incoming, status: 'PARTIALLY_COMPLETED', testRunId: $runId}),
               (completed:TransferEvent {id: $completed, requisitionNumber: $completed, status: 'COMPLETED', testRunId: $runId}),
               (a)-[:DELIVERED_FROM]->(out)-[:DELIVERED_TO]->(b),
               (c)-[:DELIVERED_FROM]->(incoming)-[:DELIVERED_TO]->(a),
               (a)-[:DELIVERED_FROM]->(completed)-[:DELIVERED_TO]->(d),
               (out)-[:INVOLVES {status: 'IN_TRANSIT'}]->(outAsset),
               (incoming)-[:INVOLVES {status: 'IN_TRANSIT'}]->(inAsset),
               (completed)-[:INVOLVES {status: 'RECEIVED'}]->(oldAsset),
               (a)-[:HAS_CUSTODY]->(custodyAsset)
      `, {
        runId,
        a: id('a'), b: id('b'), c: id('c'), d: id('d'), unrelated: id('unrelated'),
        outAsset: id('out-asset'), inAsset: id('in-asset'), oldAsset: id('old-asset'),
        custodyAsset: id('custody-asset'),
        out: id('out'), incoming: id('incoming'), completed: id('completed'),
      });
    } finally {
      await session.close();
    }
  }, 30000);

  afterAll(async () => {
    if (!driver) return;
    const session = driver.session();
    try {
      await session.run('MATCH (n) WHERE n.testRunId = $runId DETACH DELETE n', { runId });
    } finally {
      await session.close();
      await driver.close();
    }
  });

  const names = (ids: (string | null | undefined)[]) =>
    ids.map((value) => value?.startsWith(runId) ? value.slice(runId.length) : value).sort();

  const expectGraph = async (
    input: NetworkCanvasInput,
    expected: { organizations: string[]; transfers: string[]; assets: string[] },
  ) => {
    const graph = await repository.getGraph(input);
    expect(names(graph.organizations.map((org) => org.id))).toEqual(expected.organizations.sort());
    expect(names(graph.transfers.map((transfer) => transfer.requisitionNumber))).toEqual(expected.transfers.sort());
    expect(names(graph.assets.map((asset) => asset.id))).toEqual(expected.assets.sort());
    const orgIds = new Set(graph.organizations.map((org) => org.id));
    for (const transfer of graph.transfers) {
      expect(orgIds.has(transfer.senderOrgId)).toBe(true);
      expect(orgIds.has(transfer.receiverOrgId)).toBe(true);
    }
    return graph;
  };

  it('includes the receiver of an outgoing transfer for a sender-only filter', async () => {
    const graph = await expectGraph(filters({ whitelistSenders: [id('a')] }), {
      organizations: ['a', 'b'], transfers: ['out'], assets: ['out-asset', 'custody-asset'],
    });
    expect(graph.custodyLinks).toEqual([{ orgId: id('a'), assetId: id('custody-asset') }]);
  });

  it('includes the sender of an incoming transfer for a receiver-only filter', async () => {
    await expectGraph(filters({ whitelistReceivers: [id('a')] }), {
      organizations: ['a', 'c'], transfers: ['incoming'], assets: ['in-asset'],
    });
  });

  it('includes outside counterparties for both lists without adding unrelated organizations', async () => {
    await expectGraph(filters({ whitelistSenders: [id('a')], whitelistReceivers: [id('a')] }), {
      organizations: ['a', 'b', 'c'], transfers: ['out', 'incoming'],
      assets: ['out-asset', 'in-asset', 'custody-asset'],
    });
  });

  it('handles distinct sender and receiver lists without dropping the actual receiver', async () => {
    await expectGraph(filters({ whitelistSenders: [id('a')], whitelistReceivers: [id('c')] }), {
      organizations: ['a', 'b', 'c'], transfers: ['out'], assets: ['out-asset', 'custody-asset'],
    });
  });

  it('includes completed transfers and their receiver only when requested', async () => {
    await expectGraph(filters({
      whitelistSenders: [id('a')], whitelistReceivers: [id('a')], includeCompletedTransferEvents: true,
    }), {
      organizations: ['a', 'b', 'c', 'd'], transfers: ['out', 'incoming', 'completed'],
      assets: ['out-asset', 'in-asset', 'custody-asset'],
    });
  });

  it('keeps selected asset filtering and includes its transfer receiver', async () => {
    await expectGraph(filters({
      whitelistSenders: [id('a')], whitelistReceivers: [id('a')], whitelistAssets: [id('out-asset')],
    }), {
      organizations: ['a', 'b'], transfers: ['out'], assets: ['out-asset'],
    });
  });

  it('includes counterparties outside both lists for explicitly selected transfers', async () => {
    await expectGraph(filters({
      whitelistSenders: [id('b')], whitelistReceivers: [id('b')], whitelistTransfers: [id('incoming')],
    }), {
      organizations: ['a', 'b', 'c'], transfers: ['incoming'], assets: ['in-asset', 'out-asset'],
    });
  });

  it('combines selected assets and transfers without returning other asset nodes', async () => {
    await expectGraph(filters({
      whitelistSenders: [id('b')], whitelistReceivers: [id('b')],
      whitelistAssets: [id('out-asset')], whitelistTransfers: [id('incoming')],
    }), {
      organizations: ['a', 'b', 'c'], transfers: ['out', 'incoming'], assets: ['out-asset'],
    });
  });

  it('preserves the unfiltered graph and handles filters with no matching nodes', async () => {
    await expectGraph(filters(), {
      organizations: ['a', 'b', 'c', 'd', 'unrelated'], transfers: ['out', 'incoming'],
      assets: ['out-asset', 'in-asset', 'old-asset', 'custody-asset'],
    });
    await expectGraph(filters({ whitelistSenders: [id('missing')] }), {
      organizations: [], transfers: [], assets: [],
    });
  });
});
