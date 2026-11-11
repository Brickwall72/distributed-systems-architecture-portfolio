// File: services/core/topology-service/client/src/widgets/NetworkCanvas/NetworkCanvas.tsx
import { useEffect, useRef, useState } from 'react';
import * as vis from 'vis-network';
import { DataSet } from 'vis-data';
import { TOPOLOGY_MUTATION_EVENT } from '../AssetRegistration/AssetRegistration';
import { useGraph } from '../../hooks';
import { Button, useIdentity } from '@shared/ui-components';
import {
  NetworkCanvasInputSchema,
  NetworkCanvasWidgetInputSchema,
  ASSET_STATUS,
  type NetworkCanvasInput,
  type NetworkCanvasProps,
} from '@contracts/topology';

export default function NetworkCanvas(props: NetworkCanvasProps = {}) {
  const identity = useIdentity();
  const parsedInputs = NetworkCanvasWidgetInputSchema.safeParse(props);
  if (!parsedInputs.success) {
    console.warn('[NetworkCanvas MFE] Invalid props received from Host Shell:', parsedInputs.error.format());
  }
  const inputs = parsedInputs.success ? parsedInputs.data : NetworkCanvasWidgetInputSchema.parse({});

  return (
    <NetworkCanvasGraph
      key={JSON.stringify([identity?.id, identity?.orgId, inputs.enableAssetHistorySelection])}
      inputs={NetworkCanvasInputSchema.parse(inputs)}
      enableAssetHistorySelection={inputs.enableAssetHistorySelection}
    />
  );
}

function NetworkCanvasGraph({
  inputs,
  enableAssetHistorySelection,
}: {
  readonly inputs: NetworkCanvasInput;
  readonly enableAssetHistorySelection: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<vis.Network | null>(null);
  const nodesDataSetRef = useRef<DataSet<any> | null>(null);
  const edgesDataSetRef = useRef<DataSet<any> | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const { graphData, isLoading, error, refetch } = useGraph(inputs);
  const historyEnabled = enableAssetHistorySelection && selectedAssetIds.length > 0;
  const history = useGraph(
    { whitelistAssets: selectedAssetIds, includeCompletedTransferEvents: true },
    { enabled: historyEnabled },
  );
  const historyData = historyEnabled ? history.graphData : null;

  // 1. Initialize vis-network ONCE on mount
  useEffect(() => {
    if (!containerRef.current) return;

    nodesDataSetRef.current = new DataSet([]);
    edgesDataSetRef.current = new DataSet([]);

    const newInstance = new vis.Network(
      containerRef.current,
      { nodes: nodesDataSetRef.current, edges: edgesDataSetRef.current },
      {
        physics: { 
          barnesHut: { gravitationalConstant: -3500, centralGravity: 0.3, springLength: 200 },
          stabilization: { enabled: true, iterations: 500 }
        },
        interaction: {
          hover: true, dragNodes: true, zoomView: true, dragView: true,
          selectable: !enableAssetHistorySelection,
        },
      }
    );

    networkInstanceRef.current = newInstance;

    return () => {
      newInstance.destroy();
      networkInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enableAssetHistorySelection || !graphData || !networkInstanceRef.current) return;

    const network = networkInstanceRef.current;
    const assetIds = new Set(graphData.assets.map((asset) => asset.id));
    const handleClick = (event: { pointer: { DOM: { x: number; y: number } } }) => {
      const nodeId = network.getNodeAt(event.pointer.DOM);
      if (nodeId === undefined && network.getEdgeAt(event.pointer.DOM) === undefined) {
        setSelectedAssetIds([]);
        return;
      }

      if (typeof nodeId === 'string' && assetIds.has(nodeId)) {
        setSelectedAssetIds((selected) => selected.includes(nodeId)
          ? selected.filter((id) => id !== nodeId)
          : [...selected, nodeId]);
      }
    };

    network.on('click', handleClick);
    return () => network.off('click', handleClick);
  }, [enableAssetHistorySelection, graphData]);

  useEffect(() => {
    if (!graphData) return;
    const assetIds = new Set(graphData.assets.map((asset) => asset.id));
    setSelectedAssetIds((selected) => {
      const remaining = selected.filter((id) => assetIds.has(id));
      return remaining.length === selected.length ? selected : remaining;
    });
  }, [graphData]);

  // 2. Update existing datasets in-place when graphData changes to preserve node positions
  useEffect(() => {
    if (!graphData || !nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const rawNodes: any[] = [];
    const rawEdges: any[] = [];
    const trackedNodeIds = new Set<string>();
    const historyTransfers = new Set(historyData?.transfers.map((transfer) => transfer.requisitionNumber) ?? []);
    const transfers = new Map(graphData.transfers.map((transfer) => [transfer.requisitionNumber, transfer]));
    historyData?.transfers.forEach((transfer) => transfers.set(transfer.requisitionNumber, transfer));
    const historyOrganizationIds = new Set(
      historyData?.transfers.flatMap((transfer) => [transfer.senderOrgId, transfer.receiverOrgId]) ?? [],
    );
    const organizations = new Map(graphData.organizations.map((org) => [org.id, org]));
    historyData?.organizations.forEach((org) => {
      if (historyOrganizationIds.has(org.id)) organizations.set(org.id, org);
    });

    // 1. Render Organizations (Blue boxes)
    organizations.forEach((org) => {
      if (org.id && !trackedNodeIds.has(org.id)) {
        trackedNodeIds.add(org.id);
        rawNodes.push({
          id: org.id,
          label: org.name,
          shape: 'box',
          color: '#3b82f6',
          font: { color: '#ffffff' },
        });
      }
    });

    // 2. Render Assets (Indigo dots)
    graphData.assets.forEach((asset) => {
      if (asset.id && !trackedNodeIds.has(asset.id)) {
        trackedNodeIds.add(asset.id);
        const assetColor = asset.status === ASSET_STATUS.IN_TRANSIT ? '#f97316' : '#6366f1';
        rawNodes.push({
          id: asset.id,
          label: `${asset.nomenclature}\nS/N: ${asset.serialNumber}\n[${asset.status}]`,
          shape: 'dot',
          color: selectedAssetIds.includes(asset.id)
            ? { background: assetColor, border: '#111827' }
            : assetColor,
          borderWidth: selectedAssetIds.includes(asset.id) ? 4 : 1,
          font: { size: 11 },
        });
      }
    });

    // 3. Render Active Transfer Events (Amber diamonds) & In-Transit Connections
    transfers.forEach((transfer) => {
      if (transfer.requisitionNumber && !trackedNodeIds.has(transfer.requisitionNumber)) {
        trackedNodeIds.add(transfer.requisitionNumber);
        rawNodes.push({
          id: transfer.requisitionNumber,
          label: `Transfer: ${transfer.requisitionNumber}\n(${transfer.date})`,
          shape: 'diamond',
          color: '#f59e0b',
          font: { size: 10 },
        });

        if (transfer.senderOrgId) {
          rawEdges.push({ from: transfer.senderOrgId, to: transfer.requisitionNumber, label: 'DELIVERED_FROM', arrows: 'to' });
        }
        if (transfer.receiverOrgId) {
          rawEdges.push({ from: transfer.requisitionNumber, to: transfer.receiverOrgId, label: 'DELIVERED_TO', arrows: 'to' });
        }
      }

      transfer.assets.forEach((assetItem) => {
        if (assetItem.id && transfer.requisitionNumber) {
          const isInTransit = assetItem.status === ASSET_STATUS.IN_TRANSIT;
          if (isInTransit || inputs.includeCompletedTransferEvents || historyTransfers.has(transfer.requisitionNumber)) {
            rawEdges.push({
              from: transfer.requisitionNumber,
              to: assetItem.id,
              label: isInTransit ? 'IN_TRANSIT' : 'INVOLVES',
              color: { color: isInTransit ? '#f97316' : '#8b5cf6' },
              arrows: 'to',
              dashes: isInTransit,
            });
          }
        }
      });
    });

    // 4. Render Current Custody Edges
    graphData.custodyLinks.forEach((link) => {
      if (link.orgId && link.assetId) {
        rawEdges.push({
          from: link.orgId,
          to: link.assetId,
          label: 'HAS_CUSTODY',
          color: { color: '#10b981' },
          arrows: 'to',
        });
      }
    });

    // Sync nodes in-place: update existing ones (preserving positions) and remove stale ones
    const currentNodeIds = nodesDataSetRef.current.get().map((n: any) => n.id);
    const newNodeIds = new Set(rawNodes.map((n) => n.id));
    const staleNodeIds = currentNodeIds.filter((id) => !newNodeIds.has(id));

    if (staleNodeIds.length > 0) {
      nodesDataSetRef.current.remove(staleNodeIds);
    }
    nodesDataSetRef.current.update(rawNodes);

    // Sync edges in-place
    const currentEdgeIds = edgesDataSetRef.current.get().map((e: any) => e.id);
    if (currentEdgeIds.length > 0) {
      edgesDataSetRef.current.remove(currentEdgeIds);
    }
    edgesDataSetRef.current.add(rawEdges.filter((edge) => newNodeIds.has(edge.from) && newNodeIds.has(edge.to)));

  }, [graphData, historyData, inputs.includeCompletedTransferEvents, selectedAssetIds]);

  // Listen for registration mutations
  useEffect(() => {
    const handleMutation = () => {
      refetch();
      if (historyEnabled) history.refetch();
    };
    window.addEventListener(TOPOLOGY_MUTATION_EVENT, handleMutation);
    return () => {
      window.removeEventListener(TOPOLOGY_MUTATION_EVENT, handleMutation);
    };
  }, [refetch, history.refetch, historyEnabled]);

  return (
    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
      <div className={enableAssetHistorySelection
        ? 'flex flex-wrap justify-between items-center gap-2 mb-3'
        : 'absolute top-6 right-6 z-10 flex gap-2'}>
        {enableAssetHistorySelection && (
          <div className="text-sm text-gray-700">
            Select assets to show their transfer history. Click an asset again or empty space to clear.
            {selectedAssetIds.length > 0 && ` ${selectedAssetIds.length} selected.`}
          </div>
        )}
        <div className="flex flex-wrap gap-2 ml-auto">
          {enableAssetHistorySelection && selectedAssetIds.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAssetIds([])}>
              Clear selection
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              refetch();
              if (historyEnabled) history.refetch();
            }}
            isLoading={isLoading || (historyEnabled && history.isLoading)}
            className="bg-white text-gray-700 shadow-sm font-semibold"
          >
            🔄 Resync Live DB
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm text-sm">
          {error}
        </div>
      )}

      {historyEnabled && history.error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm text-sm" role="alert">
          Could not load selected assets' transfer history: {history.error}
        </div>
      )}

      {historyEnabled && history.isLoading && (
        <output className="mb-2 text-sm text-gray-600">Loading selected assets' transfer history...</output>
      )}

      {isLoading && !graphData && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20 font-semibold text-gray-500 rounded-xl">
          Traversing Space Custody Network Threads...
        </div>
      )}

      <div ref={containerRef} style={{ height: '540px' }} className="w-full rounded-lg bg-gray-50 border border-gray-100" />
    </div>
  );
}