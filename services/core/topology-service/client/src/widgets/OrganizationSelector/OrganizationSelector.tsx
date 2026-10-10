// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.tsx
import { useEffect, useMemo, useState, useRef } from 'react';
import { Select, type SelectOption } from '@shared/ui-components';
import { useOrganizations } from '../../hooks';
import {
  OrganizationSelectorInputSchema,
  type OrganizationSelectorProps,
} from '@contracts/topology';

export default function OrganizationSelector(props: Readonly<OrganizationSelectorProps>) {
  // 1. Safe MFE Boundary Parsing
  const parsedInputs = OrganizationSelectorInputSchema.safeParse(props);
  if (!parsedInputs.success) {
    console.warn('[OrganizationSelector MFE] Invalid props received:', parsedInputs.error);
  }
  const { label, filterOwnedId, excludeOrgId } = parsedInputs.success
    ? parsedInputs.data
    : { label: undefined, filterOwnedId: undefined, excludeOrgId: undefined };

  const { onSelect } = props;

  // 2. Local Selection & Interaction State
  const [selectedId, setSelectedId] = useState<string>('');
  const userClearedRef = useRef(false);

  // Track previous filtering props to determine filter transitions
  const prevPropsRef = useRef({ filterOwnedId, excludeOrgId });

  // Evaluate filtering prop changes on every render pass
  if (
    prevPropsRef.current.filterOwnedId !== filterOwnedId ||
    prevPropsRef.current.excludeOrgId !== excludeOrgId
  ) {
    const prevOwned = prevPropsRef.current.filterOwnedId;
    const prevExclude = prevPropsRef.current.excludeOrgId;

    // RULE: If filter is being removed/cleared (broadening context), suppress auto-selection!
    const isFilterCleared =
      (prevOwned && !filterOwnedId) || (prevExclude && !excludeOrgId);

    if (isFilterCleared) {
      userClearedRef.current = true; // Block auto-selection when clearing filters
    } else {
      userClearedRef.current = false; // Reset flag on narrowing/changing filters
    }

    prevPropsRef.current = { filterOwnedId, excludeOrgId };
  }

  // 3. Query Data Access Layer
  const { items, isLoading, error } = useOrganizations({ filterOwnedId });

  // 4. Map Domain DTOs to UI Select Options
  const options: SelectOption[] = useMemo(() => {
    // PRECEDENCE RULE: If an explicit asset filter returns exactly 1 holding org, 
    // bypass excludeOrgId so the true owner can still be selected.
    const effectiveItems =
      filterOwnedId && items.length === 1
        ? items
        : items.filter((org) => org.id !== excludeOrgId);

    return effectiveItems.map((org) => ({
      id: org.id,
      name: org.name,
    }));
  }, [items, excludeOrgId, filterOwnedId]);

  // 5. Handle User Selection
  const handleOrganizationSelect = (value: string) => {
    if (value === selectedId) return;

    // Explicit user deselection via placeholder choice
    if (!value) {
      userClearedRef.current = true;
      setSelectedId('');
      onSelect([]);
      return;
    }

    userClearedRef.current = false;
    setSelectedId(value);

    const selectedOrganization = items.find((organization) => organization.id === value);
    if (!selectedOrganization) {
      onSelect([]);
      return;
    }
    onSelect([selectedOrganization]);
  };

  // 6. Synchronize Selection & Auto-Select
  useEffect(() => {
    if (isLoading) return;

    // Case A: Active selection is no longer present in available options -> Clear
    if (selectedId && !options.some((option) => option.id === selectedId)) {
      setSelectedId('');
      onSelect([]);
      return;
    }

    // Case B: Auto-select single option ONLY when NOT suppressed by explicit clear/deselection
    if (options.length === 1 && selectedId !== options[0].id && !userClearedRef.current) {
      handleOrganizationSelect(options[0].id);
    }
  }, [options, selectedId, isLoading]);

  return (
    <Select
      label={label ?? "Organization Select"}
      selectedId={selectedId}
      options={options}
      isLoading={isLoading}
      error={error}
      onSelection={handleOrganizationSelect}
      loadingText="Loading organizations..."
      placeholderText="-- Select Organization --"
    />
  );
}