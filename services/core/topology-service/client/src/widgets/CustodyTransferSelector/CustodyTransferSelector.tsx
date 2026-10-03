// File: services/core/topology-service/client/src/widgets/CustodyTransferSelector/CustodyTransferSelector.tsx
import { useState, useEffect } from 'react';
import { Organization, Asset } from '@contracts/custody';
import OrganizationSelector from '../OrganizationSelector';
import AssetSelector from '../AssetSelector';

export interface CustodyTransferState {
  sourceOrg: Organization | null;
  targetOrg: Organization | null;
  asset: Asset | null;
}

export interface CustodyTransferSelectorProps {
  readonly onStateChange: (state: CustodyTransferState) => void;
}

export default function CustodyTransferSelector({
  onStateChange,
}: CustodyTransferSelectorProps) {
  const [sourceOrg, setSourceOrg] = useState<Organization | null>(null);
  const [targetOrg, setTargetOrg] = useState<Organization | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

  // Expose the aggregated state to the shell
  useEffect(() => {
    onStateChange({ sourceOrg, targetOrg, asset });
  }, [sourceOrg, targetOrg, asset, onStateChange]);

  const handleSourceOrgChange = (org: Organization | null) => {
    setSourceOrg(org);
    // Automatically clear the selected asset if the owner organization changes
    if (asset && org?.id !== sourceOrg?.id) {
      setAsset(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
      <OrganizationSelector
        label="1. Transferring Entity (From)"
        selectedId={sourceOrg?.id}
        excludeId={targetOrg?.id}
        onChange={handleSourceOrgChange}
      />
      <AssetSelector
        label="2. Asset Selection"
        selectedId={asset?.id}
        ownerId={sourceOrg?.id}
        onChange={setAsset}
      />
      <OrganizationSelector
        label="3. Receiving Entity (To)"
        selectedId={targetOrg?.id}
        excludeId={sourceOrg?.id}
        onChange={setTargetOrg}
      />
    </div>
  );
}