// File: services/core/compliance-service/client/src/widgets/TemplateSelector/TemplateSelector.tsx
import '@shared/styles';
import { Select } from '@shared/ui-components';
import { useComplianceTemplates } from '../../hooks';

interface TemplateSelectorProps {
  label?: string;
  selectedId?: string;
  onTemplateLoad: (templateId: string, rawHtml: string) => void;
}

export default function TemplateSelector({
  label = "Select Compliance Form",
  selectedId,
  onTemplateLoad,
}: Readonly<TemplateSelectorProps>) {
  const { options, isLoading, error, selectTemplate } = useComplianceTemplates({
    selectedId,
    onTemplateLoad,
  });

  return (
    <Select
      label={label}
      value={selectedId ?? ''}
      options={options}
      isLoading={isLoading}
      error={error}
      onValueChange={(val) => void selectTemplate(val)}
    />
  );
}