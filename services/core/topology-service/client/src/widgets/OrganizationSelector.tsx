// File: services/core/topology-service/client/src/widgets/OrganizationSelector.tsx
import { Organization } from '@contracts/domain';
import BaseSelector from './BaseSelector.jsx';

interface OrganizationSelectorProps {
  readonly label: string;
  readonly selectedId?: string;
  readonly excludeId?: string;
  readonly onChange: (org: Organization | null) => void;
}

export default function OrganizationSelector({
  label,
  selectedId,
  excludeId,
  onChange,
}: OrganizationSelectorProps) {
  const url = excludeId
    ? `/api/v1/topology/organizations?excludeId=${excludeId}`
    : '/api/v1/topology/organizations';

  return (
    <BaseSelector<Organization>
      label={label}
      url={url}
      dependency={excludeId}
      selectedId={selectedId}
      onChange={onChange}
      getItemId={(org) => org.id}
      renderOptionLabel={(org) => org.name}
      loadingText="Loading organizations..."
      placeholderText="-- Select Organization --"
    />
  );
};