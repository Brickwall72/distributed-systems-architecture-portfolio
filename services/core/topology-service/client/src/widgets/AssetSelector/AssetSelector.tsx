// File: services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector.tsx
import { useEffect, useMemo, useState } from 'react';
import { Select, type SelectOption } from '@shared/ui-components';
import { useGetAssets } from '../../hooks';
import {
  AssetSelectorInputSchema,
  GetAssetsQuerySchema,
  type GetAssetsQuery,
  type AssetSelectorProps,
} from '@contracts/topology';

export default function AssetSelector(props: Readonly<AssetSelectorProps>) {
  // 1. Safe MFE Boundary Parsing
  const parsedInputs = AssetSelectorInputSchema.safeParse(props);
  if (!parsedInputs.success) {
    console.warn('[AssetSelector MFE] Invalid props received from Host Shell:', parsedInputs.error.format());
  }

  const isMulti = parsedInputs.success ? parsedInputs.data.multiSelect === true : false;
  const label = parsedInputs.success ? parsedInputs.data.label : undefined;
  const queryParams: GetAssetsQuery = parsedInputs.success
    ? GetAssetsQuerySchema.parse(parsedInputs.data)
    : { includeInTransit: true, includeAvailable: true };

  const { onSelect } = props;

  // 2. Local Selection State (supports string for single, string[] for multi)
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 3. Query Data Access Layer
  const { items, isLoading, error } = useGetAssets(queryParams);

  // 4. Synchronize Selection: Clear selection if active assets are filtered out
  useEffect(() => {
    if (isMulti) {
      const validIds = selectedIds.filter((id) => items.some((item) => item.id === id));
      if (validIds.length !== selectedIds.length) {
        setSelectedIds(validIds);
        const validAssets = items.filter((item) => validIds.includes(item.id));
        (onSelect as (assets: typeof validAssets) => void)(validAssets);
      }
    } else if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId('');
      (onSelect as (asset: undefined) => void)(undefined);
    }
  }, [items, selectedId, selectedIds, isMulti, onSelect]);

  // 5. Map Domain DTOs to UI Select Options
  const options: SelectOption[] = useMemo(() => {
    return items.map((asset) => {
      const displaySerial = asset.serialNumber || 'N/A';
      return {
        id: asset.id,
        name: `${asset.name} (S/N: ${displaySerial})`,
      };
    });
  }, [items]);

  // 6. Handle Selection & Emit Appropriate Payload
  const handleSelection = (value: string | string[]) => {
    if (isMulti && Array.isArray(value)) {
      setSelectedIds(value);
      const selectedAssets = items.filter((asset) => value.includes(asset.id));
      (onSelect as (assets: typeof selectedAssets) => void)(selectedAssets);
    } else if (!isMulti && typeof value === 'string') {
      setSelectedId(value);

      if (!value) {
        (onSelect as (asset: undefined) => void)(undefined);
        return;
      }

      const selectedAsset = items.find((asset) => asset.id === value);
      if (!selectedAsset) {
        (onSelect as (asset: undefined) => void)(undefined);
        return;
      }

      (onSelect as (asset: typeof selectedAsset) => void)(selectedAsset);
    }
  };

  if (isMulti) {
    return (
      <Select
        label={label ?? "Asset Select"}
        isMulti
        selectedIds={selectedIds}
        options={options}
        isLoading={isLoading}
        error={error}
        onSelection={handleSelection}
        loadingText="Loading assets..."
        placeholderText="-- Select Assets --"
      />
    );
  }

  return (
    <Select
      label={label ?? "Asset Select"}
      selectedId={selectedId}
      options={options}
      isLoading={isLoading}
      error={error}
      onSelection={handleSelection}
      loadingText="Loading assets..."
      placeholderText="-- Select Asset --"
    />
  );
}