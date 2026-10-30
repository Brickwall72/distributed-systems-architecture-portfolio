// File: services/core/compliance-service/client/src/components/TemplateSelector/TemplateSelector.tsx
import { useEffect, useMemo, useState, useRef } from 'react';
import { Select, SelectOption } from '@shared/ui-components';
import { useTemplatesQuery, useTemplateQuery } from '../../hooks';
import { TemplateDTOwithPayloadSchema, formIdEnum, GetTemplatesQuerySchema, templateDTOwithPayloadSchema, templateId2dataSchema, formTypeEnum } from 'compliance-shared';
import { transferTypeEnum } from '@contracts/common';
import { z } from 'zod';

const templateSelectorPropsInputSchema = z.object({
  label: z.string().optional(),
  typeFilter: formTypeEnum.optional(),
  transferTypeFilter: transferTypeEnum.optional(),
})
const templateSelectorPropsDataSchema = z.object({
  label: z.string().optional(),
  queryParams: GetTemplatesQuerySchema.optional(),
});
const templateSelectorPropsSchema = templateSelectorPropsInputSchema.transform((
  { typeFilter, transferTypeFilter, ...rest }) => ({
    ...rest,
    queryParams: GetTemplatesQuerySchema.parse({
      type: typeFilter, 
      transferType: transferTypeFilter
    })
  }
)).pipe(templateSelectorPropsDataSchema);
type TemplateSelectorData = z.input<typeof templateSelectorPropsSchema> & { readonly onSelect: (template: TemplateDTOwithPayloadSchema | undefined) => void };

export function TemplateSelector(props: Readonly<TemplateSelectorData>) {
  const { label = 'Template Select', queryParams } = templateSelectorPropsSchema.parse(props);
  const { onSelect } = props;

  // Local selection state
  const [selectedId, setSelectedId] = useState('');
  const userClearedRef = useRef(false);

  // Track previous filtering props to determine filter transitions
  const prevPropsRef = useRef({...queryParams});

  // Evaluate filtering prop changes on every render pass
  if (
    prevPropsRef.current.search !== queryParams?.search ||
    prevPropsRef.current.transferType !== queryParams?.transferType ||
    prevPropsRef.current.type !== queryParams?.type
  ) {
    const prevSearch = prevPropsRef.current.search;
    const prevType = prevPropsRef.current.type;
    const prevTransferType = prevPropsRef.current.transferType;

    // RULE: If filter is being removed/cleared (broadening context), suppress auto-selection!
    const isFilterCleared =
      (prevSearch && !queryParams?.search) || 
      (prevType && !queryParams?.type) ||
      (prevTransferType && !queryParams?.transferType);

    if (isFilterCleared) {
      userClearedRef.current = true; // Block auto-selection when clearing filters
    } else {
      userClearedRef.current = false; // Reset flag on narrowing/changing filters
    }

    prevPropsRef.current = {...queryParams};
  }

  // 1. Fetch manifest options based on filters
  const { data: manifests = [], isLoading: isListLoading, error: listError } = useTemplatesQuery(queryParams);

  // 2. Fetch full DTO content only once a valid template ID is selected (the shared Select deals in plain strings)
  const selectedFormId = formIdEnum.safeParse(selectedId).data;
  const { data: activeTemplate, isLoading: isContentLoading, error: contentError } = useTemplateQuery(selectedFormId);

  // Map domain manifests to UI select options
  const options: SelectOption[] = useMemo(() => {
    return manifests.map((m) => ({
      id: m.id as string,
      name: m.name,
    }));
  }, [manifests]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const emittedIdRef = useRef('');

  const handleTemplateSelect = (value: string) => {
    if (value === selectedId) return;
    userClearedRef.current = !value;
    setSelectedId(value);
  };

  // Emit upstream only when the content for the current selection is loaded (or cleared)
  useEffect(() => {
    if (!selectedId) {
      if (emittedIdRef.current) {
        emittedIdRef.current = '';
        onSelectRef.current(undefined);
      }
      return;
    }

    if (activeTemplate?.id !== selectedId || emittedIdRef.current === selectedId) return;

    const parsed = templateDTOwithPayloadSchema.safeParse({
      ...activeTemplate,
      payloadSchema: (templateId2dataSchema as Partial<Record<string, z.ZodTypeAny>>)[activeTemplate.id],
    });
    if (!parsed.success) {
      console.warn('[TemplateSelector] Invalid template payload:', parsed.error.format());
      return;
    }
    emittedIdRef.current = selectedId;
    onSelectRef.current(parsed.data);
  }, [selectedId, activeTemplate]);

  useEffect(() => {
    if (isListLoading || listError) return;

    // Case A: Active selection is no longer present in available options -> Clear
    if (selectedId && !options.some((option) => option.id === selectedId)) {
      setSelectedId('');
      return;
    }

    // Case B: Auto-select single option ONLY when NOT suppressed by explicit clear/deselection
    if (options.length === 1 && selectedId !== options[0].id && !userClearedRef.current) {
      setSelectedId(options[0].id);
    }
  }, [options, selectedId, isListLoading, listError]);

  return (
    <div>
      <Select
        label={label}
        selectedId={selectedId}
        options={options}
        isLoading={isListLoading}
        error={listError}
        onSelection={handleTemplateSelect}
        loadingText={`Loading ${props.typeFilter ?? ''} templates...`}
        placeholderText="-- Select Template --"
      />
      {isContentLoading && selectedId && <span className="block text-sm text-gray-500">Loading template...</span>}
      {contentError && <span className="block text-sm text-red-600 font-medium">Error: {contentError}</span>}
    </div>
  );
}