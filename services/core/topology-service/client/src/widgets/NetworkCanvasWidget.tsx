// File: src/widgets/NetworkCanvasWidget.tsx
import { useEffect, useRef, useState } from 'react';
import * as vis from 'vis-network';
import { DataSet } from 'vis-data';
import { TOPOLOGY_MUTATION_EVENT } from './ConnectionFormWidget';
import { CustodyTransferRecord, EntityDirectoryResponsePayload } from '@shared/interfaces'; // Import from shared package
import '@shared/styles';

export default function NetworkCanvasWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [networkInstance, setNetworkInstance] = useState<vis.Network | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorBoundary, setErrorBoundary] = useState<string | null>(null);

  const fetchAndHydrateGraphView = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/topology/entities', {
        headers: { 'X-Correlation-ID': `UI-REFRESH-${Date.now()}` }
      });

      if (!response.ok) throw new Error(`Server returned error status: ${response.status}`);
      const payload: EntityDirectoryResponsePayload = await response.json();
      const transfers: CustodyTransferRecord[] = payload.transfers || [];

      const rawNodes: any[] = [];
      const rawEdges: any[] = [];
      const trackedNodeIds = new Set<string>();

      // Transform Event Node model into Vis.js nodes and edges
      transfers.forEach((transfer) => {
        // 1. Sender Organization Node
        if (!trackedNodeIds.has(transfer.senderOrgId)) {
          trackedNodeIds.add(transfer.senderOrgId);
          rawNodes.push({ 
            id: transfer.senderOrgId, 
            label: transfer.senderName, 
            shape: 'box', 
            color: '#3b82f6', 
            font: { color: '#ffffff' } 
          });
        }

        // 2. Transfer Event Node (DD-1149 Requisition)
        if (!trackedNodeIds.has(transfer.requisitionNumber)) {
          trackedNodeIds.add(transfer.requisitionNumber);
          rawNodes.push({ 
            id: transfer.requisitionNumber, 
            label: `DD-1149: ${transfer.requisitionNumber}\n(${transfer.transferDate})`, 
            shape: 'diamond', 
            color: '#f59e0b',
            font: { size: 10 }
          });
        }

        // 3. Receiver Organization Node
        if (!trackedNodeIds.has(transfer.receiverOrgId)) {
          trackedNodeIds.add(transfer.receiverOrgId);
          rawNodes.push({ 
            id: transfer.receiverOrgId, 
            label: transfer.receiverName, 
            shape: 'box', 
            color: '#10b981', 
            font: { color: '#ffffff' } 
          });
        }

        // 4. Asset Node
        if (!trackedNodeIds.has(transfer.assetId)) {
          trackedNodeIds.add(transfer.assetId);
          rawNodes.push({ 
            id: transfer.assetId, 
            label: `${transfer.assetNomenclature}\nS/N: ${transfer.serialNumber}`, 
            shape: 'dot', 
            color: '#6366f1' 
          });
        }

        // Build Event-Based Edges
        rawEdges.push(
          { from: transfer.senderOrgId, to: transfer.requisitionNumber, label: 'INITIATED', arrows: 'to' },
          { from: transfer.requisitionNumber, to: transfer.receiverOrgId, label: 'DELIVERED_TO', arrows: 'to' },
          { from: transfer.requisitionNumber, to: transfer.assetId, label: 'INVOLVES', arrows: 'to' }
        );
      });

      const visNodes = new DataSet(rawNodes);
      const visEdges = new DataSet(rawEdges);

      if (containerRef.current) {
        if (networkInstance) networkInstance.destroy();
        
        const newInstance = new vis.Network(
          containerRef.current, 
          { nodes: visNodes, edges: visEdges }, 
          {
            physics: { barnesHut: { gravitationalConstant: -3000, centralGravity: 0.4, springLength: 180 } },
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
    fetchAndHydrateGraphView();
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