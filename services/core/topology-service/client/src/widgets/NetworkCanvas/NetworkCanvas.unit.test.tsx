// File: services/core/topology-service/client/src/widgets/NetworkCanvas/NetworkCanvas.unit.test.tsx
import { act, fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { setTestSession } from '@shared/testing';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetworkCanvas from './NetworkCanvas';
import type { GraphDTO } from 'topology-shared';
import { NetworkCanvasInputSchema, NetworkCanvasWidgetInputSchema, type NetworkCanvasProps } from '@contracts/topology';

const network = vi.hoisted(() => ({
  instance: null as null | {
    data: { nodes: { get(): Array<{ id: string; borderWidth?: number }> }; edges: { get(): Array<{ from: string; to: string; label: string }> } };
    click?: (event: { pointer: { DOM: { x: number; y: number } } }) => void;
    node?: string;
    edge?: string;
    off: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    options: { interaction: { selectable: boolean } };
  },
}));

vi.mock('vis-network', () => {
  return {
    Network: function (_container: HTMLElement, data: NonNullable<typeof network.instance>['data'], options: NonNullable<typeof network.instance>['options']) {
      const instance: NonNullable<typeof network.instance> = {
        data,
        options,
        destroy: vi.fn(),
        off: vi.fn(),
      };
      instance.off.mockImplementation((_event, callback) => {
        if (instance.click === callback) instance.click = undefined;
      });
      Object.assign(instance, {
        on: vi.fn((_event, callback) => { instance.click = callback; }),
        getNodeAt: vi.fn(() => instance.node),
        getEdgeAt: vi.fn(() => instance.edge),
      });
      network.instance = instance;
      return instance;
    },
  };
});

const mockGraphData: GraphDTO = {
  timestamp: new Date().toISOString(),
  organizations: [
    { id: 'org-1111-lockheed', name: 'Lockheed Martin Space', type: 'CONTRACTOR', addressLine1: 'Pad 39-B' },
    { id: 'org-2222-ussf', name: 'Space Systems Command (USSF)', type: 'GOV_AGENCY', addressLine1: 'Launch Site Alpha' },
  ],
  assets: [
    {
      id: 'asset-3333-gps3',
      name: 'GPS III Space Vehicle 11',
      nomenclature: 'GPS III Space Vehicle 11',
      serialNumber: 'GPS-III-SV11-001',
      status: 'IN_TRANSIT',
      type: 'SATELLITE',
      controlType: 'LOCAL',
      currentOwnerId: 'org-1111-lockheed',
    },
  ],
  transfers: [
    {
      requisitionNumber: 'REQ-2026-SSC-0092',
      date: '20260904',
      type: 'PHYSICAL_TRANSFER',
      status: 'IN_PROGRESS',
      senderOrgId: 'org-1111-lockheed',
      senderName: 'Lockheed Martin Space',
      receiverOrgId: 'org-2222-ussf',
      receiverName: 'Space Systems Command (USSF)',
      assets: [
        {
          id: 'asset-3333-gps3',
          nomenclature: 'GPS III Space Vehicle 11',
          serialNumber: 'GPS-III-SV11-001',
          status: 'IN_TRANSIT',
          type: 'SATELLITE',
          controlType: 'LOCAL',
        },
      ],
    },
  ],
  custodyLinks: [],
};

const secondAsset: GraphDTO['assets'][number] = {
  id: 'asset-second', name: 'Second asset', nomenclature: 'Second asset',
  serialNumber: 'SN-2', status: 'AVAILABLE', type: 'SATELLITE',
  controlType: 'LOCAL', currentOwnerId: 'org-1111-lockheed',
};

const baselineGraph: GraphDTO = {
  ...mockGraphData,
  assets: [...mockGraphData.assets, secondAsset],
  custodyLinks: [{ orgId: 'org-1111-lockheed', assetId: secondAsset.id }],
};

const historyGraph: GraphDTO = {
  ...baselineGraph,
  organizations: [
    ...baselineGraph.organizations,
    { id: 'historical-org', name: 'Historical sender', type: 'CONTRACTOR', addressLine1: 'Old site' },
    { id: 'unrelated-org', name: 'Unrelated', type: 'CONTRACTOR', addressLine1: 'Other site' },
  ],
  assets: [...baselineGraph.assets, { ...secondAsset, id: 'hidden-asset' }],
  transfers: [
    ...baselineGraph.transfers,
    {
      requisitionNumber: 'history-1', date: '20260101', type: 'PHYSICAL_TRANSFER', status: 'COMPLETED',
      senderOrgId: 'historical-org', receiverOrgId: 'org-1111-lockheed',
      assets: [
        { ...baselineGraph.transfers[0].assets[0], status: 'AVAILABLE' },
        { ...secondAsset },
        { ...secondAsset, id: 'hidden-asset' },
      ],
    },
  ],
};

const server = setupServer(
  http.get('/topology/api/v1/graph', () => {
    return HttpResponse.json(mockGraphData);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NetworkCanvasWidget Component Lifecycle', () => {
  const renderNetworkCanvas = (props: NetworkCanvasProps = {}) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <NetworkCanvas {...props} />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    network.instance = null;
    setTestSession();
  });

  it('should manage the asynchronous loading state and hydrate the canvas container', async () => {
    renderNetworkCanvas();

    const loadingScreen = screen.getByText(/Traversing Space Custody Network Threads.../i);
    expect(loadingScreen).toBeInTheDocument();

    await waitForElementToBeRemoved(loadingScreen);
  });

  it('should catch a network exception and display the explicit error boundary screen', async () => {
    server.use(
      http.get('/topology/api/v1/graph', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderNetworkCanvas();

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch topology network graph/i)).toBeInTheDocument();
    });
  });

  it('overlays history for multiple selected assets without adding unrelated nodes or duplicate edges', async () => {
    const requests: URLSearchParams[] = [];
    server.use(http.get('/topology/api/v1/graph', ({ request }) => {
      const query = new URL(request.url).searchParams;
      requests.push(query);
      return HttpResponse.json(query.get('includeCompletedTransferEvents') === 'true' ? historyGraph : baselineGraph);
    }));

    const { unmount } = renderNetworkCanvas({
      enableAssetHistorySelection: true,
      whitelistSenders: ['org-1111-lockheed'],
      whitelistReceivers: ['org-1111-lockheed'],
    });
    await waitFor(() => expect(network.instance?.click).toBeDefined());
    expect(network.instance?.options.interaction.selectable).toBe(false);
    expect(requests).toHaveLength(1);
    expect(requests[0].get('whitelistSenders[0]')).toBe('org-1111-lockheed');
    expect(requests[0].get('includeCompletedTransferEvents')).toBe('false');

    const clickNode = (node?: string) => {
      if (!network.instance?.click) throw new Error('Canvas click handler was not registered');
      network.instance.node = node;
      act(() => network.instance?.click?.({ pointer: { DOM: { x: 0, y: 0 } } }));
    };

    clickNode('org-1111-lockheed');
    expect(requests).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
    clickNode('asset-3333-gps3');
    await waitFor(() => expect(network.instance?.data.nodes.get().some((node) => node.id === 'history-1')).toBe(true));
    expect(requests[1].get('whitelistAssets[0]')).toBe('asset-3333-gps3');
    expect(requests[1].get('includeCompletedTransferEvents')).toBe('true');
    expect(requests[1].has('whitelistSenders[0]')).toBe(false);
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();

    const nodes = network.instance!.data.nodes.get();
    const edges = network.instance!.data.edges.get();
    expect(nodes.find((node) => node.id === 'asset-3333-gps3')?.borderWidth).toBe(4);
    expect(nodes.map((node) => node.id)).toEqual(expect.arrayContaining(['history-1', 'historical-org', 'asset-second']));
    expect(nodes.map((node) => node.id)).not.toEqual(expect.arrayContaining(['hidden-asset', 'unrelated-org']));
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'history-1', to: 'asset-3333-gps3', label: 'INVOLVES' }),
      expect.objectContaining({ from: 'history-1', to: 'asset-second', label: 'INVOLVES' }),
      expect.objectContaining({ from: 'org-1111-lockheed', to: 'asset-second', label: 'HAS_CUSTODY' }),
    ]));
    expect(edges.some((edge) => edge.to === 'hidden-asset')).toBe(false);
    expect(edges.filter((edge) => edge.from === 'org-1111-lockheed' && edge.to === 'REQ-2026-SSC-0092')).toHaveLength(1);

    clickNode('asset-second');
    await waitFor(() => expect(requests.some((query) => query.get('whitelistAssets[1]') === 'asset-second')).toBe(true));
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
    clickNode('asset-second');
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    await waitFor(() => expect(network.instance?.data.nodes.get().some((node) => node.id === 'history-1')).toBe(false));
    expect(network.instance?.data.nodes.get().find((node) => node.id === 'asset-3333-gps3')?.borderWidth).toBe(1);

    clickNode('asset-3333-gps3');
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    clickNode();
    expect(screen.queryByText(/1 selected/)).not.toBeInTheDocument();
    const instance = network.instance;
    unmount();
    expect(instance?.off).toHaveBeenCalledWith('click', expect.any(Function));
    expect(instance?.destroy).toHaveBeenCalled();
  });

  it('keeps the baseline visible and reports history errors', async () => {
    server.use(http.get('/topology/api/v1/graph', ({ request }) =>
      new URL(request.url).searchParams.get('includeCompletedTransferEvents') === 'true'
        ? HttpResponse.json({ error: 'History unavailable' }, { status: 500 })
        : HttpResponse.json(baselineGraph),
    ));
    renderNetworkCanvas({ enableAssetHistorySelection: true });
    await waitFor(() => expect(network.instance?.click).toBeDefined());
    if (!network.instance) throw new Error('Canvas was not initialized');
    network.instance.node = 'asset-3333-gps3';
    act(() => network.instance?.click?.({ pointer: { DOM: { x: 0, y: 0 } } }));
    expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable');
    expect(network.instance.data.nodes.get().map((node) => node.id)).toContain('REQ-2026-SSC-0092');
  });

  it('does not enable selection by default', async () => {
    renderNetworkCanvas();
    await waitFor(() => expect(network.instance?.data.nodes.get().length).toBeGreaterThan(0));
    expect(network.instance?.options.interaction.selectable).toBe(true);
    expect(network.instance?.click).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
  });

  it('keeps the widget selection option out of graph query inputs', () => {
    const widgetInputs = NetworkCanvasWidgetInputSchema.parse({ enableAssetHistorySelection: true });
    expect(NetworkCanvasWidgetInputSchema.parse({}).enableAssetHistorySelection).toBe(false);
    expect(NetworkCanvasInputSchema.parse(widgetInputs)).toEqual({
      whitelistSenders: [],
      whitelistReceivers: [],
      whitelistAssets: [],
      whitelistTransfers: [],
      includeCompletedTransferEvents: false,
    });
  });
});