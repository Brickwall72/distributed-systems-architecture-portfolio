import { lazy, Suspense, useState, useEffect } from 'react';
import { Organization, Asset, DD1149TemplateData } from '@contracts/domain';

// Dynamically import all domain micro-frontend remotes via Module Federation
const CustodyTransferForm = lazy(() => import('compliance_client/CustodyTransferForm'));
const OrganizationSelector = lazy(() => import('topology_client/OrganizationSelectorWidget'));
const AssetSelector = lazy(() => import('topology_client/AssetSelectorWidget'));
const GeneratePdfButton = lazy(() => import('pdf_client/GeneratePdfButton'));

export default function CustodyTransferPage() {
  const [sourceOrg, setSourceOrg] = useState<Organization | null>(null);
  const [targetOrg, setTargetOrg] = useState<Organization | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

  // Keep a local cache of organizations at the page level for lookup
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Fetch organizations on mount so we can resolve asset owners automatically
  useEffect(() => {
    fetch('/api/v1/topology/organizations')
      .then((res) => res.json())
      .then((data: Organization[]) => setOrganizations(data))
      .catch((err) => console.error('Failed to load organizations for lookup:', err));
  }, []);

  // Handler for Asset Selection with Auto-Source Resolution
  const handleAssetChange = (selectedAsset: Asset | null) => {
    console.log('--- Asset Selection Triggered ---');
    console.log('Selected Asset Object:', selectedAsset);
    console.log('Current Organizations Cache:', organizations);

    setAsset(selectedAsset);

    if (selectedAsset) {
      // Check both currentOwnerId and ownerId in case of backend schema discrepancies
      const ownerIdKey = selectedAsset.currentOwnerId || (selectedAsset as any).ownerId;
      console.log('Resolved Owner ID Key:', ownerIdKey);

      if (ownerIdKey) {
        const matchingOrg = organizations.find((org) => org.id === ownerIdKey);
        console.log('Matching Organization Found:', matchingOrg);

        if (matchingOrg) {
          setSourceOrg(matchingOrg);
          if (targetOrg?.id === matchingOrg.id) {
            setTargetOrg(null);
          }
        } else {
          console.warn(`⚠️ Organization ID "${ownerIdKey}" was not found in the organizations cache! Are organizations still loading or is the ID mismatched?`);
        }
      } else {
        console.warn('⚠️ Selected asset object has no owner ID property (checked currentOwnerId and ownerId).');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Select-Driven Custody Routing</h3>
        
        {/* Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Suspense fallback={<div className="text-slate-500 text-sm">Loading source selector...</div>}>
            <OrganizationSelector
              label="1. From (Source)"
              selectedId={sourceOrg?.id}
              excludeId={targetOrg?.id}
              onChange={(org: Organization) => {
                setSourceOrg(org);
                // Reset asset if the newly chosen source doesn't own it anymore
                if (asset && org && asset.currentOwnerId !== org.id) {
                  setAsset(null);
                }
              }}
            />
          </Suspense>

          <Suspense fallback={<div className="text-slate-500 text-sm">Loading asset selector...</div>}>
            <AssetSelector
              label="2. Asset to Transfer"
              selectedId={asset?.id}
              ownerId={sourceOrg?.id}
              excludeOwnerId={targetOrg?.id} // <--- Pass target org ID here
              onChange={handleAssetChange}
            />
          </Suspense>

          <Suspense fallback={<div className="text-slate-500 text-sm">Loading target selector...</div>}>
            <OrganizationSelector
              label="3. To (Destination)"
              selectedId={targetOrg?.id}
              excludeId={sourceOrg?.id}
              onChange={(org: Organization) => {
                setTargetOrg(org);
                // If the newly chosen target owns the currently selected asset, clear the asset
                if (asset && org && asset.currentOwnerId === org.id) {
                  setAsset(null);
                }
              }}
            />
          </Suspense>
        </div>
      </div>

      {/* Form Orchestrator & Federated PDF Generator */}
      <Suspense fallback={<div className="text-slate-500 text-center py-8">Loading transfer orchestrator...</div>}>
        <CustodyTransferForm
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          asset={asset}
        >
          {(payload: DD1149TemplateData | null, isValid: boolean) => (
            <Suspense fallback={<div className="text-slate-500">Loading PDF button...</div>}>
              <GeneratePdfButton
                disabled={!isValid}
                htmlPayload={JSON.stringify(payload)}
                fileName={`DD-1149-${payload?.requisitionNumber || 'draft'}.pdf`}
              />
            </Suspense>
          )}
        </CustodyTransferForm>
      </Suspense>
    </div>
  );
}