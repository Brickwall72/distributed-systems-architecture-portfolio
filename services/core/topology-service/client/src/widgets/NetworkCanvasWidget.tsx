// File: src/widgets/NetworkCanvasWidget.tsx
import { useEffect, useRef, useState } from 'react';
import * as vis from 'vis-network';
import { DataSet } from 'vis-data';
import { TOPOLOGY_MUTATION_EVENT } from './ConnectionFormWidget';
import '@shared/styles';

interface TopologyEntityLink {
  sourceAssetId: string;
  sourceLabel: string;
  targetAssetId: string;
  targetLabel: string;
  actionContext: string;
}

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
      const payload = await response.json();
      const links: TopologyEntityLink[] = payload.connections || [];

      const rawNodes: any[] = [];
      const rawEdges: any[] = [];
      const trackedNodeIds = new Set<string>();

      links.forEach((link) => {
        if (!trackedNodeIds.has(link.sourceAssetId)) {
          trackedNodeIds.add(link.sourceAssetId);
          rawNodes.push({ id: link.sourceAssetId, label: link.sourceLabel, shape: 'dot', color: '#3b82f6' });
        }
        if (!trackedNodeIds.has(link.targetAssetId)) {
          trackedNodeIds.add(link.targetAssetId);
          rawNodes.push({ id: link.targetAssetId, label: link.targetLabel, shape: 'square', color: '#10b981' });
        }
        rawEdges.push({ from: link.sourceAssetId, to: link.targetAssetId, label: link.actionContext, arrows: 'to' });
      });

      const visNodes = new DataSet(rawNodes);
      const visEdges = new DataSet(rawEdges);

      if (containerRef.current) {
        if (networkInstance) networkInstance.destroy();
        
        const newInstance = new vis.Network(
          containerRef.current, 
          { nodes: visNodes, edges: visEdges }, 
          {
            physics: { barnesHut: { gravitationalConstant: -2000, centralGravity: 0.3, springLength: 150 } },
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

      {/* ERROR BANNER RESTORED HERE */}
      {errorBoundary && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm text-sm">
          {errorBoundary}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20 font-semibold text-gray-500 rounded-xl">
          Traversing Graph Network Threads...
        </div>
      )}
      
      <div ref={containerRef} style={{ height: '540px' }} className="w-full rounded-lg bg-gray-50 border border-gray-100" />
    </div>
  );
}