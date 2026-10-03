// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.tsx
import { useMemo } from 'react';
import { Organization } from '@contracts/custody';
import { Select, SelectOption } from '@shared/ui-components';
import { GetOrganizationsParams } from '../../api';
import { useOrganizations } from '../../hooks';

export interface OrganizationSelectorProps extends GetOrganizationsParams {
  readonly label: string;
  readonly selectedId?: string;
  readonly onChange: (organization: Organization | null) => void;
}

export default function OrganizationSelector({
  label,
  selectedId,
  parentId,
  onChange,
}: Readonly<OrganizationSelectorProps>) {
  const { items, isLoading, error } = useOrganizations({ parentId });

  // Map domain models to presentational options (Name)
  const options: SelectOption[] = useMemo(() => {
    return items.map((org) => ({
      value: org.id,
      label: org.name,
    }));
  }, [items]);

  // Translate string ID selection back to the domain object
  const handleValueChange = (value: string) => {
    const selectedOrg = items.find((org) => org.id === value) || null;
    onChange(selectedOrg);
  };

  return (
    <Select
      label={label}
      value={selectedId}
      options={options}
      isLoading={isLoading}
      error={error}
      onValueChange={handleValueChange}
      loadingText="Loading organizations..."
      placeholderText="-- Select Organization --"
    />
  );
}