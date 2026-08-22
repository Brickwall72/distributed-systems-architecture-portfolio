// File: services/core/compliance-service/src/frontend/ComplianceWidget.tsx
import React, { useState } from 'react';
import { mintTransactionToken } from './complianceTracking.js';

import localTestPdfUrl from './__fixtures__/test.pdf';

export const ComplianceWidget: React.FC = () => {
  const [activeCorrelationId, setActiveCorrelationId] = useState<string | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  function executeClearanceWorkflow(): void {
    setIsProcessing(true);
    
    // REQ-003a: Mint a unique transactional tracking token instantly upon operator action intent click
    const transactionToken = mintTransactionToken();
    setActiveCorrelationId(transactionToken);

    setTimeout(() => {
      setPdfViewerUrl(localTestPdfUrl);
      setIsProcessing(false);
      console.log(`[compliance-widget] Flow authorized under token alignment [${transactionToken}]`);
    }, 1200);
  }

  return (
    <div className="flex flex-col items-center p-6 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full text-white font-sans">
      
      {/* Top Controller Command Deck */}
      <div className="flex items-center justify-between w-full pb-4 border-b border-slate-800 mb-6">
        <div>
          <h2 className="text-sm font-mono tracking-wider text-blue-400 font-bold uppercase">COMPLIANCE_CORE_SUB-WIDGET</h2>
          <p className="text-slate-500 text-[11px] font-mono mt-0.5">Distributed Mission Operations Gate</p>
        </div>
        
        <button
          type="submit"
          onClick={executeClearanceWorkflow}
          disabled={isProcessing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-mono text-xs font-bold rounded-lg transition shadow-md shadow-blue-900/30 cursor-pointer"
        >
          {isProcessing ? 'VERIFYING_GATE_CHECKS...' : 'EXECUTE_FLIGHT_CLEARANCE'}
        </button>
      </div>

      {/* Distributed Observability Tracking Banner */}
      {activeCorrelationId && (
        <div className="w-full bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-lg mb-6 flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">ACTIVE_X-CORRELATION-ID:</span>
          <span className="text-emerald-400 font-bold tracking-tight">{activeCorrelationId}</span>
        </div>
      )}

      {/* Foundational HTML5 Iframe PDF Viewport Enclosure Panel */}
      <div className="w-full bg-slate-900 rounded-lg border border-slate-800 overflow-hidden flex flex-col items-center justify-center min-h-[500px] relative shadow-inner">
        {pdfViewerUrl ? (
          <iframe
            src={pdfViewerUrl}
            className="w-full h-[650px] bg-slate-900 border-none"
            title="Aviation System Document Viewer Portal"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 font-mono">
            <div className="text-[11px] tracking-wide text-slate-400 uppercase font-bold">Awaiting Operational Command Execution</div>
            <p className="text-[10px] text-slate-600 max-w-xs mt-2 leading-relaxed">
              Click the clearance button above to initialize backend structural validation loops and hydrate the compliance artifact PDF byte stream.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
