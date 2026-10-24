// File: services/core/topology-service/client/src/widgets/NetworkCanvas/NetworkCanvas.tsx
import { useEffect, useRef } from 'react';
import * as vis from 'vis-network';
import { DataSet } from 'vis-data';
import { TOPOLOGY_MUTATION_EVENT } from '../AssetRegistration/AssetRegistration';
import { useGraph } from '../../hooks';
import { Button } from '@shared/ui-components';

export default function NetworkCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkInstanceRef = useRef<vis.Network | null>(null);
  const nodesDataSetRef = useRef<DataSet<any> | null>(null);
  const edgesDataSetRef = useRef<DataSet<any> | null>(null);

  const { graphData, isLoading, error, refetch } = useGraph();

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
        interaction: { hover: true, dragNodes: true, zoomView: true, dragView: true },
      }
    );

    networkInstanceRef.current = newInstance;

    return () => {
      newInstance.destroy();
      networkInstanceRef.current = null;
    };
  }, []);

  // 2. Update existing datasets in-place when graphData changes to preserve node positions
  useEffect(() => {
    if (!graphData || !nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const rawNodes: any[] = [];
    const rawEdges: any[] = [];
    const trackedNodeIds = new Set<string>();

    // 1. Render Organizations (Blue boxes)
    graphData.organizations.forEach((org) => {
      if (!trackedNodeIds.has(org.id)) {
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
      if (!trackedNodeIds.has(asset.id)) {
        trackedNodeIds.add(asset.id);
        rawNodes.push({
          id: asset.id,
          label: `${asset.nomenclature}\nS/N: ${asset.serialNumber}\n[${asset.status}]`,
          shape: 'dot',
          color: asset.status === 'IN_TRANSIT' ? '#f97316' : '#6366f1',
          font: { size: 11 },
        });
      }
    });

    // 3. Render Active Transfer Events (Amber diamonds) & In-Transit Connections
    graphData.activeTransfers.forEach((transfer) => {
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
        if (assetItem.id && transfer.requisitionNumber && assetItem.status === 'IN_TRANSIT') {
          rawEdges.push({
            from: transfer.requisitionNumber,
            to: assetItem.id,
            label: 'IN_TRANSIT',
            color: { color: '#f97316' },
            arrows: 'to',
            dashes: true,
          });
        }
      });
    });

    // 4. Render Current Custody Edges
    graphData.custodyLinks.forEach((link) => {
      rawEdges.push({
        from: link.orgId,
        to: link.assetId,
        label: 'HAS_CUSTODY',
        color: { color: '#10b981' },
        arrows: 'to',
      });
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
    edgesDataSetRef.current.add(rawEdges);

  }, [graphData]);

  // Listen for registration mutations
  useEffect(() => {
    const handleMutation = () => {
      refetch();
    };
    window.addEventListener(TOPOLOGY_MUTATION_EVENT, handleMutation);
    return () => {
      window.removeEventListener(TOPOLOGY_MUTATION_EVENT, handleMutation);
    };
  }, [refetch]);

  return (
    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
      <div className="absolute top-6 right-6 z-10 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isLoading={isLoading}
          className="bg-white text-gray-700 shadow-sm font-semibold"
        >
          🔄 Resync Live DB
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm text-sm">
          {error}
        </div>
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