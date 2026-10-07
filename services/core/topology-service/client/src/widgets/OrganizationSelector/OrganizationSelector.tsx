// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.tsx
import { useEffect, useMemo, useState } from 'react';
import { Select, type SelectOption } from '@shared/ui-components';
import { useOrganizations } from '../../hooks';
import {
  OrganizationSelectorInputSchema,
  type OrganizationSelectorProps,
  type OrganizationBase,
} from '@contracts/topology';

export default function OrganizationSelector(props: Readonly<OrganizationSelectorProps>) {
  // 1. Safe MFE Boundary Parsing: Prevents invalid Shell props from crashing the render tree
  const parsedInputs = OrganizationSelectorInputSchema.safeParse(props);
  if (!parsedInputs.success) {
    console.warn('[OrganizationSelector MFE] Invalid props received:', parsedInputs.error);
  }
  const { filterOwnedId, excludeOrgId } = parsedInputs.success
    ? parsedInputs.data
    : { filterOwnedId: undefined, excludeOrgId: undefined };

  const { onSelect } = props;

  // 2. Local Selection State
  const [selectedId, setSelectedId] = useState<string>('');

  // 3. Query Data Access Layer
  const { items, isLoading, error } = useOrganizations({ filterOwnedId });

  // 4. Synchronize Selection: Clear selection if active organization is filtered out by prop changes
  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId('');
      onSelect([]);
    }
  }, [items, selectedId, onSelect]);

  // 5. Map Domain DTOs to UI Select Options
  const options: SelectOption[] = useMemo(() => {
    return items
      .filter((org) => org.id !== excludeOrgId)
      .map((org) => ({
        value: org.id,
        label: org.name,
      }));
  }, [items, excludeOrgId]);

  // 6. Handle Selection & Emit Uniform OrganizationBase[] Payload
  const handleValueChange = (value: string) => {
    setSelectedId(value);

    if (!value) {
      onSelect([]);
      return;
    }

    const selectedOrganization = items.find((organization) => organization.id === value);
    if (!selectedOrganization) {
      onSelect([]);
      return;
    }

    // Normalize domain object to strict OrganizationBase schema shape
    const organizationPayload: OrganizationBase = selectedOrganization;

    // Always emit array to maintain List Collection Pattern with Host Shell
    onSelect([organizationPayload]);
  };

  return (
    <Select
      label="Select Organization"
      value={selectedId}
      options={options}
      isLoading={isLoading}
      error={error ?? undefined}
      onValueChange={handleValueChange}
      loadingText="Loading organizations..."
      placeholderText="-- Select Organization --"
    />
  );
}