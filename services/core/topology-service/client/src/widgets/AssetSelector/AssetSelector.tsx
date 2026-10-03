// File: services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector.tsx
import { useMemo } from 'react';
import { Asset } from '@contracts/custody';
import { Select, SelectOption } from '@shared/ui-components';
import { GetAssetsParams } from '../../api';
import { useAssets } from '../../hooks';

export interface AssetSelectorProps extends GetAssetsParams {
  readonly label: string;
  readonly selectedId?: string;
  readonly onChange: (asset: Asset | null) => void;
}

export default function AssetSelector({
  label,
  selectedId,
  ownerId,
  excludeOwnerId,
  onChange,
}: Readonly<AssetSelectorProps>) {
  const { items, isLoading, error } = useAssets({ ownerId, excludeOwnerId });

  // Map domain models to purely presentational UI options
  const options: SelectOption[] = useMemo(() => {
    return items.map((asset) => ({
      value: asset.id,
      label: `${asset.nomenclature} (S/N: ${asset.serialNumber})`,
    }));
  }, [items]);

  // Translate the raw string selection back into the domain object
  const handleValueChange = (value: string) => {
    const selectedAsset = items.find((asset) => asset.id === value) || null;
    onChange(selectedAsset);
  };

  return (
    <Select
      label={label}
      value={selectedId}
      options={options}
      isLoading={isLoading}
      error={error}
      onValueChange={handleValueChange}
      loadingText="Loading assets..."
      placeholderText="-- Select Asset --"
    />
  );
}