// File: services/core/compliance-service/client/src/components/TemplateSelector/TemplateSelector.tsx
import { useEffect, useMemo, useState } from 'react';
import { Select, type SelectOption } from '@shared/ui-components';
import { useTemplatesQuery, useTemplateQuery } from '../../hooks';
import type { TemplateDTO, FormType, FormName } from 'compliance-shared';

export type FormTypeFilter = FormType | 'ALL';

export interface TemplateSelectorProps {
  /**
   * Visible form field label displayed above the dropdown control.
   *
   * @default 'Template Select'
   */
  readonly label?: string;

  /**
   * Filter criteria passed to the template query hook to restrict selectable forms by compliance category.
   *
   * @default 'ALL'
   */
  readonly typeFilter?: FormTypeFilter;

  /**
   * Event callback triggered when a compliance template is fetched and loaded into active memory.
   * Emits the resolved canonical `TemplateDTO` payload to downstream workflow viewers.
   *
   * @param template The loaded compliance template domain object.
   */
  readonly onSelect: (template: TemplateDTO) => void;
}

export function TemplateSelector(props: Readonly<TemplateSelectorProps>) {
  const { label = 'Template Select', typeFilter = 'ALL', onSelect } = props;

  // Local selection state
  const [selectedId, setSelectedId] = useState<FormName>();

  // 1. Fetch manifest options based on type filter
  const queryParams = typeFilter === 'ALL' ? undefined : { type: typeFilter };
  const { data: manifests = [], isLoading: isListLoading, error: listError } = useTemplatesQuery(queryParams);

  // 2. Fetch full DTO content for the actively selected template ID
  const { data: activeTemplate, isLoading: isContentLoading, error: contentError } = useTemplateQuery(selectedId as FormName);

  // Synchronize and auto-select template on manifest or filter changes
  useEffect(() => {
    const isValidSelection = selectedId && manifests.some((m) => m.id === selectedId);

    if (!isValidSelection) {
      // If nothing is selected or the current selection was filtered out,
      // fallback to the first available manifest (or clear if empty)
      setSelectedId(manifests.length > 0 ? manifests[0].id : undefined);
    }
  }, [manifests, selectedId]);

  // Emit full DTO payload upstream whenever activeTemplate successfully loads
  useEffect(() => {
    if (activeTemplate) {
      onSelect(activeTemplate);
    }
  }, [activeTemplate, onSelect]);

  // Map domain manifests to UI select options
  const options: SelectOption[] = useMemo(() => {
    return manifests.map((m) => ({
      id: m.id,
      name: m.name,
    }));
  }, [manifests]);

  return (
    <Select
      label={label}
      selectedId={selectedId}
      options={options}
      isLoading={isListLoading || isContentLoading}
      error={listError || contentError}
      onSelection={(id) => setSelectedId(id as FormName)}
      loadingText={`Loading ${typeFilter} templates...`}
      placeholderText="-- Select Template --"
    />
  );
}