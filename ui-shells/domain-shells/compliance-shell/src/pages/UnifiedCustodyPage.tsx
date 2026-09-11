// File: ui-shells/domain-shells/compliance-shell/src/pages/UnifiedCustodyPage.tsx
import { useState, useMemo, Suspense, lazy } from 'react';
import { Organization, Asset, DD1149TemplateData } from '@contracts/domain';
import { DocumentViewer, hydrateTemplate } from '@shared/ui-components';

// Micro-Frontend Federated Remote Imports
const OrganizationSelector = lazy(() => import('topology_client/OrganizationSelectorWidget'));
const AssetSelector = lazy(() => import('topology_client/AssetSelectorWidget'));
const GeneratePdfButton = lazy(() => import('pdf_client/GeneratePdfButton'));
const TemplateSelector = lazy(() => import('compliance_client/TemplateSelector'));

export default function UnifiedCustodyPage() {
  // 1. Selector States
  const [sourceOrg, setSourceOrg] = useState<Organization | null>(null);
  const [targetOrg, setTargetOrg] = useState<Organization | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

  // 2. Form Metadata
  const [requisitionNumber] = useState('REQ-2026-001');
  const [transferDate] = useState(new Date().toDateString());

  // 3. Template Selection & Content (Managed via TemplateSelector widget)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [rawTemplateHtml, setRawTemplateHtml] = useState<string>('');
  
  // 4. PDF Blob State
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Callback triggered when TemplateSelector mounts or user selects a template
  const handleTemplateLoad = (templateId: string, rawHtml: string) => {
    setSelectedTemplateId(templateId);
    setRawTemplateHtml(rawHtml);
    setPdfBlobUrl(null); // Reset PDF view when template changes
  };

  // Construct typed data payload matching DD1149TemplateDataSchema
  const templatePayload: DD1149TemplateData | null = useMemo(() => {
    if (!(sourceOrg || targetOrg || asset)) return null;

    return {
      fromEntityName: sourceOrg?.name ?? '',
      fromAddressLine1: sourceOrg?.addressLine1 ?? '',
      fromAddressLine2: sourceOrg?.addressLine2 ?? '',
      toEntityName: targetOrg?.name ?? '',
      toAddressLine1: targetOrg?.addressLine1 ?? '',
      toAddressLine2: targetOrg?.addressLine2 ?? '',
      requisitionNumber,
      transferDate,
      items: [
        {
          itemNumber: 1,
          nomenclature: asset?.nomenclature ?? '',
          serialNumber: asset?.serialNumber ?? '',
          unit: 'EA',
          quantity: 1,
        },
      ],
    };
  }, [sourceOrg, targetOrg, asset, requisitionNumber, transferDate]);

  const isReadyForPdf = Boolean(sourceOrg && targetOrg && asset && templatePayload);

  // Hydrate template HTML programmatically using the shared interpolation engine
  const hydratedHtml = useMemo(() => {
    if (!rawTemplateHtml) return '';
    if (!templatePayload) return rawTemplateHtml; // Renders blank/unfilled template preview
    return hydrateTemplate(rawTemplateHtml, templatePayload);
  }, [rawTemplateHtml, templatePayload]);

  return (
    <div className="flex flex-col h-screen p-6 gap-6 bg-slate-950 text-slate-100">
      {/* Top Header & Template Selector */}
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-4 w-72">
          <Suspense fallback={<div className="text-sm text-slate-400">Loading template selector...</div>}>
            <TemplateSelector
              label="Compliance Form"
              selectedId={selectedTemplateId}
              onTemplateLoad={handleTemplateLoad}
            />
          </Suspense>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {pdfBlobUrl && (
            <button
              onClick={() => setPdfBlobUrl(null)}
              className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded-md transition"
            >
              Back to Interactive View
            </button>
          )}

          <Suspense fallback={<div className="text-sm text-slate-400">Loading PDF generator...</div>}>
            <GeneratePdfButton
              htmlPayload={isReadyForPdf && hydratedHtml}
              fileName={`${selectedTemplateId || 'document'}-${requisitionNumber}.pdf`}
              onSuccess={(blobUrl: string) => setPdfBlobUrl(blobUrl)}
            />
          </Suspense>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <Suspense fallback={<div className="text-slate-500 text-sm">Loading source selector...</div>}>
          <OrganizationSelector
            label="1. Transferring Entity (From)"
            selectedId={sourceOrg?.id}
            excludeId={targetOrg?.id}
            onChange={(org: Organization) => setSourceOrg(org)}
          />
        </Suspense>

        <Suspense fallback={<div className="text-slate-500 text-sm">Loading asset selector...</div>}>
          <AssetSelector
            label="2. Asset Selection"
            selectedId={asset?.id}
            ownerId={sourceOrg?.id}
            onChange={(selectedAsset: Asset) => setAsset(selectedAsset)}
          />
        </Suspense>

        <Suspense fallback={<div className="text-slate-500 text-sm">Loading target selector...</div>}>
          <OrganizationSelector
            label="3. Receiving Entity (To)"
            selectedId={targetOrg?.id}
            excludeId={sourceOrg?.id}
            onChange={(org: Organization) => setTargetOrg(org)}
          />
        </Suspense>
      </div>

      {/* Dynamic Document Viewer Workspace */}
      <main className="flex-1 bg-white rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
        <DocumentViewer
          content={pdfBlobUrl ?? hydratedHtml}
          contentType={pdfBlobUrl ? 'pdf' : 'html'}
          title="Live Compliance Document"
          className="w-full h-full"
        />
      </main>
    </div>
  );
}