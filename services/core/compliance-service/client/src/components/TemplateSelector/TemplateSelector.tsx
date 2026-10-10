// File: services/core/compliance-service/client/src/components/TemplateSelector/TemplateSelector.tsx
import { Select } from '@shared/ui-components';
import { useComplianceTemplates } from '../../hooks';
import { TemplateDTO, TemplateType } from 'compliance-shared';
import { useState } from 'react';

export type TemplateTypeFilter = TemplateType | 'ALL';

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
  readonly typeFilter?: TemplateTypeFilter;

  /**
   * Event callback triggered when a compliance template is fetched and loaded into active memory.
   * Emits the resolved canonical `TemplateDTO` payload to downstream workflow viewers.
   *
   * @param template - The loaded compliance template domain object.
   */
  readonly onTemplateLoad: (template: TemplateDTO) => void;
}

export function TemplateSelector(props: Readonly<TemplateSelectorProps>) {
  const { label = 'Template Select', typeFilter = 'ALL', onTemplateLoad } = props;
  const [selectedId, setSelectedId] = useState<string>('');

  const { options, isLoading, error, selectTemplate } = useComplianceTemplates({
    selectedId,
    onTemplateLoad: (templateId, rawHtml) => {
      onTemplateLoad({
        id: templateId,
        name: 'test',
        rawHTML: rawHtml,
        type: 'AUTHORIZATION',
      });
      setSelectedId(templateId);
    },
  });

  const handleSelection = (val: string) => {
    setSelectedId(val);
    void selectTemplate(val);
  };

  return (
    <Select
      label={label}
      selectedId={selectedId}
      options={options}
      isLoading={isLoading}
      error={error}
      onSelection={handleSelection}
      loadingText={`Loading ${typeFilter} templates...`}
      placeholderText="-- Select Template --"
    />
  );
}