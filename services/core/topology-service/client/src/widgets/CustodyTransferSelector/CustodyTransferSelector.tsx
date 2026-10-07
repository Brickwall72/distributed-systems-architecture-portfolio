// File: services/core/topology-service/client/src/widgets/CustodyTransferSelector/CustodyTransferSelector.tsx
import { useState, useEffect } from 'react';
import OrganizationSelector from '../OrganizationSelector';
import AssetSelector from '../AssetSelector';
import type { 
  AssetBase,
  OrganizationBase,
  AssetSelectorProps,
  OrganizationSelectorProps
} from '@contracts/topology';


export interface CustodyTransferState {
  sourceOrg: OrganizationBase | null;
  targetOrg: OrganizationBase | null;
  selectedAsset: AssetBase | null;
}

export interface CustodyTransferSelectorProps {
  readonly onStateChange: (state: CustodyTransferState) => void;
}

export default function CustodyTransferSelector({
  onStateChange,
}: CustodyTransferSelectorProps) {
  const [sourceOrg, setSourceOrg] = useState<OrganizationBase[]>([]);
  const [targetOrg, setTargetOrg] = useState<OrganizationBase[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<AssetBase[]>([]);

  const selectAssetProps: AssetSelectorProps = {
    onSelect: setSelectedAssets,
  };

  const selectSourceOrgProps: OrganizationSelectorProps = {
    onSelect: setSourceOrg,
  };
  const selectTargetOrgProps: OrganizationSelectorProps = {
    onSelect: setTargetOrg,
  };

  // Expose the aggregated state to the shell
  useEffect(() => {
    onStateChange({ sourceOrg: sourceOrg[0], targetOrg: targetOrg[0], selectedAsset: selectedAssets[0] });
  }, [sourceOrg, targetOrg, selectedAssets, onStateChange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
      <OrganizationSelector
        {...selectSourceOrgProps}
      />
      <AssetSelector
        {...selectAssetProps}
      />
      <OrganizationSelector
        {...selectTargetOrgProps}
      />
    </div>
  );
}