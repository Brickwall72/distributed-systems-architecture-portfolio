// File: services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector.tsx
import { useEffect, useMemo, useState } from 'react';
import { Select, type SelectOption } from '@shared/ui-components';
import { useAssets } from '../../hooks';
import {
  AssetSelectorInputSchema,
  type AssetSelectorProps,
  type AssetBase,
} from '@contracts/topology';

export default function AssetSelector(props: Readonly<AssetSelectorProps>) {
  // 1. Safe MFE Boundary Parsing: Prevents invalid Shell props from crashing the render tree
  const parsedInputs = AssetSelectorInputSchema.safeParse(props);
  const { filterOwnerId, excludeOwnerId } = parsedInputs.success
    ? parsedInputs.data
    : { filterOwnerId: undefined, excludeOwnerId: undefined };

  const { onSelect } = props;

  // 2. Local Selection State
  const [selectedId, setSelectedId] = useState<string>('');

  // 3. Query Data Access Layer
  const { items, isLoading, error } = useAssets({ filterOwnerId, excludeOwnerId });

  // 4. Synchronize Selection: Clear selection if active asset is filtered out by prop changes
  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId('');
      onSelect([]);
    }
  }, [items, selectedId, onSelect]);

  // 5. Map Domain DTOs to UI Select Options
  const options: SelectOption[] = useMemo(() => {
    return items.map((asset) => {
      const displayName = asset.nomenclature || asset.name || asset.id;
      const displaySerial = asset.serialNumber || 'N/A';
      return {
        value: asset.id,
        label: `${displayName} (S/N: ${displaySerial})`,
      };
    });
  }, [items]);

  // 6. Handle Selection & Emit Uniform AssetBase[] Payload
  const handleValueChange = (value: string) => {
    setSelectedId(value);

    if (!value) {
      onSelect([]);
      return;
    }

    const selectedAsset = items.find((asset) => asset.id === value);
    if (!selectedAsset) {
      onSelect([]);
      return;
    }

    // Normalize domain object to strict AssetBase schema shape
    const assetPayload: AssetBase = {
      ...selectedAsset,
      id: selectedAsset.id,
      name: selectedAsset.nomenclature ?? selectedAsset.name ?? selectedAsset.id,
    };

    // Always emit array to maintain List Collection Pattern with Host Shell
    onSelect([assetPayload]);
  };

  // Log runtime contract violations without throwing unhandled render errors
  if (!parsedInputs.success) {
    console.warn('[AssetSelector MFE] Invalid props received from Host Shell:', parsedInputs.error.format());
  }

  return (
    <Select
      label="Select Asset"
      value={selectedId}
      options={options}
      isLoading={isLoading}
      error={error ?? undefined}
      onValueChange={handleValueChange}
      loadingText="Loading assets..."
      placeholderText="-- Select Asset --"
    />
  );
}