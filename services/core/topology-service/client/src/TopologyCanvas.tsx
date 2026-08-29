// File: services/core/topology-service/client/src/TopologyCanvas.tsx
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { DataSet } from 'vis-data';
import * as vis from 'vis-network';

/**
 * Represents a directional connection between two topology assets.
 */
interface TopologyEntityLink {
  sourceAssetId: string;
  sourceLabel: string;
  targetAssetId: string;
  targetLabel: string;
  actionContext: string;
}

/**
 * Renders the live topology graph, supports manual connection creation, and
 * refreshes the visualization from the backend topology service.
 */
export default function TopologyCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [networkInstance, setNetworkInstance] = useState<vis.Network | null>(null);
  const [nodesDataSet, setNodesDataSet] = useState<DataSet<any> | null>(null);
  const [edgesDataSet, setEdgesDataSet] = useState<DataSet<any> | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorBoundary, setErrorBoundary] = useState<string | null>(null);

  /*
   * The form state is kept separate from the visualization state so the user can
   * build a connection without mutating the network until submission.
   */
  const [sourceId, setSourceId] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [actionContext, setActionContext] = useState('SQUADRON_HANDOVER');

  /**
   * Fetches the current topology graph from the API and rehydrates the vis.js
   * network with the latest node and edge metadata.
   */
  const fetchAndHydrateGraphView = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/topology/entities', {
        headers: { 'X-Correlation-ID': `UI-REFRESH-${Date.now()}` }
      });

      if (!response.ok) throw new Error(`Server returned error status code: ${response.status}`);
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
      setNodesDataSet(visNodes);
      setEdgesDataSet(visEdges);

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
    return () => { if (networkInstance) networkInstance.destroy(); };
  }, []);

  /**
   * Submits a user-defined asset link to the in-memory graph model.
   *
   * @param e - Browser submit event for the connection form.
   */
  const handleGraphMutationSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!sourceId.trim() || !targetId.trim()) return;

    if (nodesDataSet && edgesDataSet) {
      if (!nodesDataSet.get(sourceId)) {
        nodesDataSet.add({ id: sourceId, label: sourceLabel || sourceId, shape: 'dot', color: '#3b82f6' });
      }
      if (!nodesDataSet.get(targetId)) {
        nodesDataSet.add({ id: targetId, label: targetLabel || targetId, shape: 'square', color: '#10b981' });
      }
      edgesDataSet.add({ from: sourceId, to: targetId, label: actionContext, arrows: 'to' });
    }

    setSourceId('');
    setSourceLabel('');
    setTargetId('');
    setTargetLabel('');
  };

  return (
    <div className="p-6 font-sans max-w-7xl mx-auto">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Mission Control: Fleet Topology Graph</h1>
        <p className="text-sm text-gray-500 mt-1">Manage physical asset deployments and verify connectivity paths across the cluster mesh.</p>
      </header>

      {errorBoundary && <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm">{errorBoundary}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* The left column holds the form used to create or extend topology edges. */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Deploy Asset Connection</h2>
          <form onSubmit={handleGraphMutationSubmit} className="space-y-4">
            
            {/* CORRECTED: Linked htmlFor explicitly to input id tokens across all form fields */}
            <div>
              <label htmlFor="source-id-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Source Node ID</label>
              <input id="source-id-input" type="text" value={sourceId} onChange={(e) => setSourceId(e.target.value)} placeholder="e.g. ac-f16-alpha" required className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
            </div>
            
            <div>
              <label htmlFor="source-label-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Source Display Label</label>
              <input id="source-label-input" type="text" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="e.g. F-16 Flight Alpha" className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
            </div>
            
            <div className="border-t border-dashed my-3 pt-2">
              <label htmlFor="target-id-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Target Node ID</label>
              <input id="target-id-input" type="text" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="e.g. fob-bastion" required className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 focus:outline-none transition" />
            </div>
            
            <div>
              <label htmlFor="target-label-input" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Target Display Label</label>
              <input id="target-label-input" type="text" value={targetLabel} onChange={(e) => setTargetLabel(e.target.value)} placeholder="e.g. FOB Bastion Outpost" className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 focus:outline-none transition" />
            </div>
            
            <div>
              <label htmlFor="action-context-select" className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Authorization Context Path</label>
              <select id="action-context-select" value={actionContext} onChange={(e) => setActionContext(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition">
                <option value="SQUADRON_HANDOVER">SQUADRON_HANDOVER</option>
                <option value="CARGO_TRANSFER">CARGO_TRANSFER</option>
              </select>
            </div>
            
            <button type="submit" disabled={isLoading} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all transform active:scale-95 shadow-md flex items-center justify-center disabled:opacity-50">
              Inject Graph Connection
            </button>
          </form>
        </div>

        {/* The right column renders the live graph canvas and refresh controls. */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
          <div className="absolute top-6 right-6 z-10 flex gap-2">
            <button type="button" onClick={fetchAndHydrateGraphView} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg p-2 shadow-sm text-xs font-semibold flex items-center gap-1.5 transition active:scale-95">
              🔄 Resync Live DB
            </button>
          </div>
          {isLoading && !nodesDataSet && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20 font-semibold text-gray-500 rounded-xl">
              Traversing Graph Network Threads...
            </div>
          )}
          <div ref={containerRef} style={{ height: '540px' }} className="w-full rounded-lg bg-gray-50 border border-gray-100" />
        </div>
      </div>
    </div>
  );
}
