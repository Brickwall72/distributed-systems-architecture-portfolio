// File: services/core/topology-service/client/src/widgets/AssetSelector.tsx
import { Asset } from '@contracts/domain';
import BaseSelector from './BaseSelector.jsx';

interface AssetSelectorProps {
  readonly label: string;
  readonly selectedId?: string;
  readonly ownerId?: string;
  readonly excludeOwnerId?: string; // <--- Add this prop
  readonly onChange: (asset: Asset | null) => void;
}

export default function AssetSelector({
  label,
  selectedId,
  ownerId,
  excludeOwnerId,
  onChange,
}: Readonly<AssetSelectorProps>) {
  const params = new URLSearchParams();
  if (ownerId) params.append('ownerId', ownerId);
  if (excludeOwnerId) params.append('excludeOwnerId', excludeOwnerId);

  const queryString = params.toString();
  const url = queryString ? `/topology/api/v1/assets?${queryString}` : '/topology/api/v1/assets';

  return (
    <BaseSelector<Asset>
      label={label}
      url={url}
      dependency={`${ownerId}-${excludeOwnerId}`}
      selectedId={selectedId}
      onChange={onChange}
      getItemId={(asset) => asset.id}
      renderOptionLabel={(asset) => `${asset.nomenclature} (S/N: ${asset.serialNumber})`}
      loadingText="Loading assets..."
      placeholderText="-- Select Asset --"
    />
  );
}