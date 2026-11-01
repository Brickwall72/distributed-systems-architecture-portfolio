// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.tsx
import { useEffect, useMemo, useState, useRef } from 'react';
import { Select, type SelectOption } from '@shared/ui-components';
import { useGetOrganizations } from '../../hooks';
import {
  OrganizationSelectorInputSchema,
  GetOrganizationsQuerySchema,
  type GetOrganizationsQuery,
  type OrganizationSelectorProps,
  type OrganizationDTO,
  type OrganizationDTOList,
} from '@contracts/topology';

export default function OrganizationSelector(props: Readonly<OrganizationSelectorProps>) {
  // 1. Safe MFE Boundary Parsing
  const parsedInputs = OrganizationSelectorInputSchema.safeParse(props);
  if (!parsedInputs.success) {
    console.warn('[OrganizationSelector MFE] Invalid props received:', parsedInputs.error);
  }
  const label = parsedInputs.success ? parsedInputs.data.label : undefined;
  const excludeOrgId = parsedInputs.success ? parsedInputs.data.excludeOrgId : undefined;
  const queryParams: GetOrganizationsQuery = parsedInputs.success
    ? GetOrganizationsQuerySchema.parse(parsedInputs.data)
    : { requireActiveAssets: false };
  const { filterOwnedId, transferEventId } = queryParams;
  const isMulti = parsedInputs.success ? parsedInputs.data.multiSelect === true : false;

  const { onSelect } = props;
  const emitSingle = onSelect as (org: OrganizationDTO | undefined) => void;
  const emitMulti = onSelect as (orgs: OrganizationDTOList) => void;

  // 2. Local Selection & Interaction State (string for single, string[] for multi)
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const userClearedRef = useRef(false);

  // Track previous filtering props to determine filter transitions
  const prevPropsRef = useRef({ filterOwnedId, excludeOrgId, transferEventId });

  // Evaluate filtering prop changes on every render pass
  if (
    prevPropsRef.current.filterOwnedId !== filterOwnedId ||
    prevPropsRef.current.excludeOrgId !== excludeOrgId ||
    prevPropsRef.current.transferEventId !== transferEventId
  ) {
    const prevOwned = prevPropsRef.current.filterOwnedId;
    const prevExclude = prevPropsRef.current.excludeOrgId;
    const prevTransferEventId = prevPropsRef.current.transferEventId;

    // RULE: If filter is being removed/cleared (broadening context), suppress auto-selection!
    const isFilterCleared =
      (prevOwned && !filterOwnedId) || (prevExclude && !excludeOrgId) || (prevTransferEventId && !transferEventId);

    if (isFilterCleared) {
      userClearedRef.current = true; // Block auto-selection when clearing filters
    } else {
      userClearedRef.current = false; // Reset flag on narrowing/changing filters
    }

    prevPropsRef.current = { filterOwnedId, excludeOrgId, transferEventId };
  }

  // 3. Query Data Access Layer
  const { items: orgs, isLoading, error } = useGetOrganizations(queryParams);

  // 4. Map Domain DTOs to UI Select Options
  const options: SelectOption[] = useMemo(() => {
    // PRECEDENCE RULE: If an explicit asset filter returns exactly 1 holding org, 
    // bypass excludeOrgId so the true owner can still be selected.
    const effectiveOrgs =
      filterOwnedId && orgs.length === 1
        ? orgs
        : orgs.filter((org) => org.id !== excludeOrgId);

    return effectiveOrgs.map((org) => ({
      id: org.id,
      name: org.name,
    }));
  }, [orgs, excludeOrgId, filterOwnedId]);

  // 5. Handle User Selection
  const handleOrganizationSelect = (value: string) => {
    if (value === selectedId) return;

    // Explicit user deselection via placeholder choice
    if (!value) {
      userClearedRef.current = true;
      setSelectedId('');
      emitSingle(undefined);
      return;
    }

    userClearedRef.current = false;
    setSelectedId(value);

    const selectedOrganization = orgs.find((organization) => organization.id === value);
    emitSingle(selectedOrganization ?? undefined);
  };

  const handleMultiSelect = (values: string[]) => {
    setSelectedIds(values);
    emitMulti(orgs.filter((organization) => values.includes(organization.id)));
  };

  // 6. Synchronize Selection & Auto-Select
  useEffect(() => {
    if (isLoading) return;

    if (isMulti) {
      // Prune selections that are no longer available
      const validIds = selectedIds.filter((id) => options.some((option) => option.id === id));
      if (validIds.length !== selectedIds.length) {
        setSelectedIds(validIds);
        emitMulti(orgs.filter((organization) => validIds.includes(organization.id)));
      }
      return;
    }

    // Case A: Active selection is no longer present in available options -> Clear
    if (selectedId && !options.some((option) => option.id === selectedId)) {
      setSelectedId('');
      emitSingle(undefined);
      return;
    }

    // Case B: Auto-select single option ONLY when NOT suppressed by explicit clear/deselection
    if (options.length === 1 && selectedId !== options[0].id && !userClearedRef.current) {
      handleOrganizationSelect(options[0].id);
    }
  }, [options, selectedId, selectedIds, isMulti, isLoading, transferEventId]);

  if (isMulti) {
    return (
      <Select
        label={label ?? "Organization Select"}
        isMulti
        selectedIds={selectedIds}
        options={options}
        isLoading={isLoading}
        error={error}
        onSelection={(value) => handleMultiSelect(Array.isArray(value) ? value : [value])}
        loadingText="Loading organizations..."
        placeholderText="-- Select Organizations --"
      />
    );
  }

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