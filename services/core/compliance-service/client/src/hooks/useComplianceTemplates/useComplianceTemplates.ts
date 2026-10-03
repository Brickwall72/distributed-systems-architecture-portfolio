// File: services/core/compliance-service/client/src/hooks/useComplianceTemplates/useComplianceTemplates.ts
import { useState, useEffect, useCallback } from 'react';
import type { SelectOption } from '@shared/ui-components';
import {
  fetchTemplateManifest,
  fetchTemplateContent,
  type TemplateManifest,
} from '../../api';

interface UseComplianceTemplatesOptions {
  selectedId?: string;
  onTemplateLoad: (templateId: string, rawHtml: string) => void;
}

export function useComplianceTemplates({
  selectedId,
  onTemplateLoad,
}: UseComplianceTemplatesOptions) {
  const [templates, setTemplates] = useState<TemplateManifest[]>([]);
  const [isManifestLoading, setIsManifestLoading] = useState(true);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch template list on mount with unmount cleanup
  useEffect(() => {
    let isSubscribed = true;
    setIsManifestLoading(true);

    fetchTemplateManifest()
      .then((data) => {
        if (isSubscribed) setTemplates(data);
      })
      .catch((err: Error) => {
        if (isSubscribed) setError(err.message);
      })
      .finally(() => {
        if (isSubscribed) setIsManifestLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Fetch individual template content on user selection
  const selectTemplate = useCallback(
    async (id: string) => {
      if (!id) return;
      setIsContentLoading(true);
      setError(null);

      try {
        const html = await fetchTemplateContent(id);
        onTemplateLoad(id, html);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setIsContentLoading(false);
      }
    },
    [onTemplateLoad]
  );

  // Auto-select first template if none is active
  useEffect(() => {
    if (templates.length > 0 && !selectedId && !isManifestLoading && !isContentLoading) {
      void selectTemplate(templates[0].id);
    }
  }, [templates, selectedId, isManifestLoading, isContentLoading, selectTemplate]);

  const options: SelectOption[] = templates.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  return {
    options,
    isLoading: isManifestLoading || isContentLoading,
    error,
    selectTemplate,
  };
}