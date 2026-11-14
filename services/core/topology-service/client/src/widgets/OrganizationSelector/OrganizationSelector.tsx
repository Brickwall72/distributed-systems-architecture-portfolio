// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.tsx
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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

function hasLockedSelectionChanged(
  isMulti: boolean,
  selectedIds: string[],
  selectedId: string,
  nextId: string | undefined,
  organizationChanged: boolean,
): boolean {
  if (organizationChanged) return true;
  if (isMulti) {
    return selectedIds.length !== (nextId ? 1 : 0) || (nextId !== undefined && selectedIds[0] !== nextId);
  }
  return selectedId !== (nextId ?? '');
}

type FilterProps = {
  filterOwnedId: string | undefined;
  excludeOrgId: string | undefined;
  transferEventId: string | undefined;
};

function updateFilterTracking(
  previous: React.RefObject<FilterProps>,
  current: FilterProps,
  userCleared: React.RefObject<boolean>,
): void {
  const prev = previous.current;
  if (
    prev.filterOwnedId === current.filterOwnedId &&
    prev.excludeOrgId === current.excludeOrgId &&
    prev.transferEventId === current.transferEventId
  ) {
    return;
  }

  userCleared.current = Boolean(
    (prev.filterOwnedId && !current.filterOwnedId) ||
      (prev.excludeOrgId && !current.excludeOrgId) ||
      (prev.transferEventId && !current.transferEventId),
  );
  previous.current = current;
}

function buildOrganizationOptions(
  orgs: OrganizationDTO[],
  onlyOrgId: string | undefined,
  filterOwnedId: string | undefined,
  excludeOrgId: string | undefined,
): SelectOption[] {
  const candidateOrgs = onlyOrgId ? orgs.filter((org) => org.id === onlyOrgId) : orgs;
  const effectiveOrgs =
    filterOwnedId && candidateOrgs.length === 1
      ? candidateOrgs
      : candidateOrgs.filter((org) => org.id !== excludeOrgId);
  return effectiveOrgs.map((org) => ({ id: org.id, name: org.name }));
}

function renderLockedSelection(
  onlyOrgId: string,
  isLoading: boolean,
  error: string | undefined,
  options: SelectOption[],
): React.ReactElement | null {
  if (isLoading) return <output>Loading organization...</output>;
  if (error) return <p role="alert">{error}</p>;
  if (!options.some((option) => option.id === onlyOrgId)) {
    return <p role="alert">Your organization is unavailable for this selection.</p>;
  }
  return null;
}

export default function OrganizationSelector(props: Readonly<OrganizationSelectorProps>) {
  // 1. Safe MFE Boundary Parsing
  const parsedInputs = OrganizationSelectorInputSchema.safeParse(props);
  if (!parsedInputs.success) {
    console.warn('[OrganizationSelector MFE] Invalid props received:', parsedInputs.error);
  }
  const label = parsedInputs.success ? parsedInputs.data.label : undefined;
  const excludeOrgId = parsedInputs.success ? parsedInputs.data.excludeOrgId : undefined;
  const onlyOrgId = parsedInputs.success ? parsedInputs.data.onlyOrgId : undefined;
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
  const previousOnlyOrgId = useRef(onlyOrgId);
  const emittedLockedOrganization = useRef<OrganizationDTO | undefined>(undefined);

  // Track previous filtering props to determine filter transitions
  const prevPropsRef = useRef({ filterOwnedId, excludeOrgId, transferEventId });

  // Evaluate filtering prop changes on every render pass.
  updateFilterTracking(prevPropsRef, { filterOwnedId, excludeOrgId, transferEventId }, userClearedRef);

  // 3. Query Data Access Layer
  const { items: orgs, isLoading, error } = useGetOrganizations(queryParams);

  // 4. Map Domain DTOs to UI Select Options
  const options: SelectOption[] = useMemo(() => {
    return buildOrganizationOptions(orgs, onlyOrgId, filterOwnedId, excludeOrgId);
  }, [orgs, excludeOrgId, filterOwnedId, onlyOrgId]);

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

  const clearUnlockedSelection = useCallback(() => {
    emittedLockedOrganization.current = undefined;
    userClearedRef.current = true;
    if (isMulti && selectedIds.length) {
      setSelectedIds([]);
      emitMulti([]);
    } else if (!isMulti && selectedId) {
      setSelectedId('');
      emitSingle(undefined);
    }
  }, [isMulti, selectedIds.length, selectedId, emitMulti, emitSingle]);

  const syncLockedSelection = useCallback(() => {
    const option = !isLoading && !error ? options.find((item) => item.id === onlyOrgId) : undefined;
    const organization = option ? orgs.find((item) => item.id === option.id) : undefined;
    const organizationChanged = JSON.stringify(emittedLockedOrganization.current) !== JSON.stringify(organization);
    emittedLockedOrganization.current = organization;
    const nextId = organization?.id;
    const selectionChanged = hasLockedSelectionChanged(isMulti, selectedIds, selectedId, nextId, organizationChanged);

    if (selectionChanged) {
      if (isMulti) {
        setSelectedIds(nextId ? [nextId] : []);
        emitMulti(organization ? [organization] : []);
      } else {
        setSelectedId(nextId ?? '');
        emitSingle(organization);
      }
    }
  }, [isLoading, error, options, onlyOrgId, orgs, isMulti, selectedIds, selectedId, emitMulti, emitSingle]);

  const pruneMultiSelection = useCallback(() => {
    const validIds = selectedIds.filter((id) => options.some((option) => option.id === id));
    if (validIds.length !== selectedIds.length) {
      setSelectedIds(validIds);
      emitMulti(orgs.filter((organization) => validIds.includes(organization.id)));
    }
  }, [selectedIds, options, emitMulti, orgs]);

  const syncSingleSelection = useCallback(() => {
    if (selectedId && !options.some((option) => option.id === selectedId)) {
      setSelectedId('');
      emitSingle(undefined);
      return;
    }

    if (options.length === 1 && selectedId !== options[0].id && !userClearedRef.current) {
      handleOrganizationSelect(options[0].id);
    }
  }, [selectedId, options, emitSingle, handleOrganizationSelect]);

  // 6. Synchronize Selection & Auto-Select
  useEffect(() => {
    const previousLockedId = previousOnlyOrgId.current;
    previousOnlyOrgId.current = onlyOrgId;
    if (previousLockedId !== undefined && previousLockedId !== onlyOrgId) {
      clearUnlockedSelection();
      return;
    }

    if (isLoading) return;

    if (onlyOrgId) {
      syncLockedSelection();
      return;
    }

    if (error) return;

    if (isMulti) {
      pruneMultiSelection();
      return;
    }

    syncSingleSelection();
  }, [
    isMulti,
    isLoading,
    error,
    transferEventId,
    onlyOrgId,
    clearUnlockedSelection,
    syncLockedSelection,
    pruneMultiSelection,
    syncSingleSelection,
  ]);

  if (onlyOrgId) {
    return renderLockedSelection(onlyOrgId, isLoading, error ?? undefined, options);
  }

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