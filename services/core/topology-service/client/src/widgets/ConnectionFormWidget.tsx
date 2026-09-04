// File: src/widgets/ConnectionFormWidget.tsx
import { useState, type SyntheticEvent } from 'react';
import '@shared/styles';

// Define a standardized event name so typos don't break the sync
export const TOPOLOGY_MUTATION_EVENT = 'topology:graph-mutated';

export default function ConnectionFormWidget() {
  const [sourceId, setSourceId] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [actionContext, setActionContext] = useState('SQUADRON_HANDOVER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!sourceId.trim() || !targetId.trim()) return;

    try {
      setIsSubmitting(true);
      
      const payload = { sourceId, sourceLabel, targetId, targetLabel, actionContext };
      
      // 1. Make the actual API call to your backend/Neo4j
      await fetch('/api/v1/topology/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // 2. Announce to the entire browser that the database was updated
      window.dispatchEvent(new CustomEvent(TOPOLOGY_MUTATION_EVENT));

      // 3. Reset the form
      setSourceId('');
      setSourceLabel('');
      setTargetId('');
      setTargetLabel('');
    } catch (error) {
      console.error("Failed to inject connection:", error);
      // In a real app, you might set a local error state here to show a toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-fit">
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Deploy Asset Connection</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
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

        <button type="submit" disabled={isSubmitting} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all transform active:scale-95 shadow-md flex items-center justify-center disabled:opacity-50">
          {isSubmitting ? 'Injecting...' : 'Inject Graph Connection'}
        </button>
      </form>
    </div>
  );
}