// File: src/widgets/NetworkCanvasWidget.tsx
import { useEffect, useRef, useState } from 'react';
import * as vis from 'vis-network';
import { DataSet } from 'vis-data';
import { TOPOLOGY_MUTATION_EVENT } from './ConnectionFormWidget';
import '@shared/styles';

interface TopologyGraphPayload {
  timestamp: string;
  organizations: Array<{ id: string; name: string; type: string }>;
  assets: Array<{ id: string; nomenclature: string; serialNumber: string; status: string }>;
  activeTransfers: Array<{
    requisitionNumber: string;
    date: string;
    status: string;
    senderOrgId: string;
    receiverOrgId: string;
    assetId: string;
    invStatus: string;
  }>;
  custodyLinks: Array<{ orgId: string; assetId: string }>;
}

export default function NetworkCanvasWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [networkInstance, setNetworkInstance] = useState<vis.Network | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorBoundary, setErrorBoundary] = useState<string | null>(null);

  const fetchAndHydrateGraphView = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/topology/api/v1/entities', {
        headers: { 'X-Correlation-ID': `UI-REFRESH-${Date.now()}` }
      });

      if (!response.ok) throw new Error(`Server returned error status: ${response.status}`);
      const payload: TopologyGraphPayload = await response.json();

      const rawNodes: any[] = [];
      const rawEdges: any[] = [];
      const trackedNodeIds = new Set<string>();

      // 1. Render Organizations (Blue boxes)
      payload.organizations.forEach((org) => {
        if (!trackedNodeIds.has(org.id)) {
          trackedNodeIds.add(org.id);
          rawNodes.push({
            id: org.id,
            label: org.name,
            shape: 'box',
            color: '#3b82f6',
            font: { color: '#ffffff' }
          });
        }
      });

      // 2. Render Assets (Indigo dots)
      payload.assets.forEach((asset) => {
        if (!trackedNodeIds.has(asset.id)) {
          trackedNodeIds.add(asset.id);
          rawNodes.push({
            id: asset.id,
            label: `${asset.nomenclature}\nS/N: ${asset.serialNumber}\n[${asset.status}]`,
            shape: 'dot',
            color: asset.status === 'IN_TRANSIT' ? '#f97316' : '#6366f1',
            font: { size: 11 }
          });
        }
      });

      // 3. Render Active Transfer Events (Amber diamonds) & In-Transit Connections
      payload.activeTransfers.forEach((transfer) => {
        if (transfer.requisitionNumber && !trackedNodeIds.has(transfer.requisitionNumber)) {
          trackedNodeIds.add(transfer.requisitionNumber);
          rawNodes.push({
            id: transfer.requisitionNumber,
            label: `Transfer: ${transfer.requisitionNumber}\n(${transfer.date})`,
            shape: 'diamond',
            color: '#f59e0b',
            font: { size: 10 }
          });

          if (transfer.senderOrgId) {
            rawEdges.push({ from: transfer.senderOrgId, to: transfer.requisitionNumber, label: 'INITIATED', arrows: 'to' });
          }
          if (transfer.receiverOrgId) {
            rawEdges.push({ from: transfer.requisitionNumber, to: transfer.receiverOrgId, label: 'DELIVERED_TO', arrows: 'to' });
          }
        }

        // Connect active/in-transit assets to the transfer event
        if (transfer.assetId && transfer.requisitionNumber && transfer.invStatus === 'IN_TRANSIT') {
          rawEdges.push({
            from: transfer.requisitionNumber,
            to: transfer.assetId,
            label: 'IN_TRANSIT',
            color: { color: '#f97316' },
            arrows: 'to',
            dashes: true
          });
        }
      });

      // 4. Render Current Custody Edges
      payload.custodyLinks.forEach((link) => {
        rawEdges.push({
          from: link.orgId,
          to: link.assetId,
          label: 'HAS_CUSTODY',
          color: { color: '#10b981' },
          arrows: 'to'
        });
      });

      const visNodes = new DataSet(rawNodes);
      const visEdges = new DataSet(rawEdges);

      if (containerRef.current) {
        if (networkInstance) networkInstance.destroy();
        
        const newInstance = new vis.Network(
          containerRef.current,
          { nodes: visNodes, edges: visEdges },
          {
            physics: { barnesHut: { gravitationalConstant: -3500, centralGravity: 0.3, springLength: 200 } },
            interaction: { hover: true, dragNodes: true, zoomView: true, dragView: true }
          }
        );
        setNetworkInstance(newInstance);
      }
      setErrorBoundary(null);
    } catch (err: any) {
      setErrorBoundary(`Failed to aggregate live topology layers: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAndHydrateGraphView();
    window.addEventListener(TOPOLOGY_MUTATION_EVENT, fetchAndHydrateGraphView);
    return () => {
      window.removeEventListener(TOPOLOGY_MUTATION_EVENT, fetchAndHydrateGraphView);
      if (networkInstance) networkInstance.destroy();
    };
  }, []);

  return (
    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
      <div className="absolute top-6 right-6 z-10 flex gap-2">
        <button type="button" onClick={fetchAndHydrateGraphView} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg p-2 shadow-sm text-xs font-semibold flex items-center gap-1.5 transition active:scale-95">
          🔄 Resync Live DB
        </button>
      </div>

      {errorBoundary && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm text-sm">
          {errorBoundary}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20 font-semibold text-gray-500 rounded-xl">
          Traversing Space Custody Network Threads...
        </div>
      )}
      
      <div ref={containerRef} style={{ height: '540px' }} className="w-full rounded-lg bg-gray-50 border border-gray-100" />
    </div>
  );
}