// File: services/core/topology-service/server/src/repositories/graph/graph.repository.unit.test.ts
import { once } from 'node:events';
import { createServer } from 'node:http';
import { beginOperation, createLogger, startTracing, stopTracing } from '@shared/express';
import { GraphRepository } from './graph.repository';
import type { Driver, Session } from 'neo4j-driver';

describe('GraphRepository', () => {
  const auditor = { kind: 'auditor' } as const;
  let repository: GraphRepository;
  let mockSession: Partial<Session>;
  let mockDriver: Partial<Driver>;
  let queryParams: Record<string, unknown> | undefined;

  const mockTopologyRecord = {
    get: (key: string) => {
      if (key === 'topologyGraph') {
        return {
          organizations: [
            { id: 'org-1', name: 'Alpha Command', type: 'CONTRACTOR', addressLine1: 'Pad 39-B' },
          ],
          assets: [
            { id: 'asset-1', name: 'Probe Mk I', nomenclature: 'Probe Mk I', serialNumber: 'KSP-01', status: 'AVAILABLE' },
          ],
          transfers: [],
          custodyLinks: [
            { orgId: 'org-1', assetId: 'asset-1' },
          ],
        };
      }
      return null;
    },
  };

  beforeEach(() => {
    mockSession = {
      executeRead: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          run: vi.fn().mockImplementation(async (_query: string, params: Record<string, unknown>) => {
            queryParams = params;
            return {
            records: [mockTopologyRecord],
            };
          }),
        };
        return callback(tx);
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockDriver = {
      session: vi.fn().mockReturnValue(mockSession as Session),
    } as unknown as Driver;

    repository = new GraphRepository(mockDriver as Driver);
    queryParams = undefined;
  });

  it('should successfully execute read query and return structured GraphDTO', async () => {
    const graph = await repository.getGraph(undefined, auditor);

    expect(mockSession.executeRead).toHaveBeenCalledTimes(1);
    expect(graph).toHaveProperty('timestamp');
    expect(graph.organizations).toHaveLength(1);
    expect(graph.organizations[0].name).toBe('Alpha Command');
    expect(graph.assets).toHaveLength(1);
    expect(graph.assets[0].status).toBe('AVAILABLE');
    expect(graph.custodyLinks).toHaveLength(1);
    expect(graph.custodyLinks[0]).toEqual({ orgId: 'org-1', assetId: 'asset-1' });
  });

  it('should return fallback empty collections if query yields no records', async () => {
    (mockSession.executeRead as any).mockImplementation(async (callback: any) => {
      const tx = {
        run: vi.fn().mockResolvedValue({
          records: [],
        }),
      };
      return callback(tx);
    });

    const graph = await repository.getGraph(undefined, auditor);

    expect(graph.organizations).toEqual([]);
    expect(graph.assets).toEqual([]);
    expect(graph.transfers).toEqual([]);
    expect(graph.custodyLinks).toEqual([]);
    expect(graph.timestamp).toBeTypeOf('string');
  });

  it('should pass whitelist filters and completed-event inclusion to Neo4j', async () => {
    await repository.getGraph({
      whitelistSenders: ['sender-1'],
      whitelistReceivers: ['receiver-1'],
      whitelistAssets: ['asset-1'],
      whitelistTransfers: ['transfer-1'],
      includeCompletedTransferEvents: true,
    }, auditor);

    expect(queryParams).toEqual({
      whitelistSenders: ['sender-1'],
      whitelistReceivers: ['receiver-1'],
      whitelistAssets: ['asset-1'],
      whitelistTransfers: ['transfer-1'],
      includeCompletedTransferEvents: true,
      scopeOrgId: null,
    });
  });

  it('exports nested graph and Neo4j spans for successful and failed reads without graph data', async () => {
    type ExportedSpan = {
      name: string;
      traceId: string;
      spanId: string;
      parentSpanId?: string;
      status?: { code?: number };
    };
    const spans: ExportedSpan[] = [];
    const exports: string[] = [];
    const collector = createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => { body += chunk; });
      req.on('end', () => {
        exports.push(body);
        const payload: { resourceSpans: { scopeSpans: { spans: ExportedSpan[] }[] }[] } = JSON.parse(body);
        for (const resource of payload.resourceSpans) {
          for (const scope of resource.scopeSpans) spans.push(...scope.spans);
        }
        res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      });
    });
    collector.listen(0, '127.0.0.1');
    await once(collector, 'listening');
    const address = collector.address();
    if (!address || typeof address === 'string') throw new Error('test collector did not bind');
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('graph-trace-test');

    try {
      startTracing('graph-trace-test', logger, {
        DSAP_TRACING_ENABLED: 'true',
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `http://127.0.0.1:${address.port}/v1/traces`,
      });
      for (const fails of [false, true]) {
        if (fails) vi.mocked(mockSession.executeRead!).mockRejectedValueOnce(new Error('database unavailable'));
        const request = beginOperation(logger, 'http.request');
        await request.run(async () => {
          const result = repository.getGraph({
            whitelistSenders: ['private-filter-id'],
            whitelistReceivers: [],
            whitelistAssets: [],
            whitelistTransfers: [],
            includeCompletedTransferEvents: false,
          }, auditor);
          if (fails) await expect(result).rejects.toThrow('database unavailable');
          else await expect(result).resolves.toMatchObject({ assets: [{ id: 'asset-1' }] });
        });
        request.finish(fails ? 'failure' : 'success');
      }
      await stopTracing(logger);

      const roots = spans.filter((span) => span.name === 'http.request');
      expect(roots).toHaveLength(2);
      for (const root of roots) {
        const trace = spans.filter((span) => span.traceId === root.traceId);
        const projection = trace.find((span) => span.name === 'topology.graph.project');
        const read = trace.find((span) => span.name === 'topology.graph.neo4j.read');
        expect(trace).toHaveLength(3);
        expect(projection?.parentSpanId).toBe(root.spanId);
        expect(read?.parentSpanId).toBe(projection?.spanId);
        if (root.status?.code === 2) {
          expect(projection?.status?.code).toBe(2);
          expect(read?.status?.code).toBe(2);
        } else {
          expect(projection?.status?.code).not.toBe(2);
          expect(read?.status?.code).not.toBe(2);
        }
      }
      expect(roots.filter((span) => span.status?.code === 2)).toHaveLength(1);
      expect(exports.join('')).not.toContain('private-filter-id');
      expect(exports.join('')).not.toContain('asset-1');
      expect(mockSession.close).toHaveBeenCalledTimes(2);
    } finally {
      await stopTracing(logger);
      logs.mockRestore();
      await new Promise<void>((resolve, reject) => collector.close((error) => error ? reject(error) : resolve()));
    }
  });
});