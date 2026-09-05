// File: ui-shells/domain-shells/compliance-shell/src/App.tsx
import { Suspense } from 'react';
import DocumentPreviewPage from './pages/DocumentPreviewPage';
import '@shared/styles';

export default function App() {
  return (
    <div className="h-full w-full flex flex-col space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white">Compliance & Flight Clearance Domain</h2>
        <p className="text-sm text-slate-400">Manage cryptographic validation gates and review safety artifacts.</p>
      </div>

      <Suspense fallback={<div className="text-slate-500 font-mono">Loading Compliance Widget...</div>}>
        <DocumentPreviewPage />
      </Suspense>
    </div>
  );
}