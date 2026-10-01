// File: services/core/compliance-service/client/src/widgets/TemplateSelector.tsx
import { useState, useEffect } from 'react';
import '@shared/styles';
import {
  fetchTemplateManifest,
  fetchTemplateContent,
  type TemplateManifest,
} from '../api';

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
  const [templates, setTemplates] = useState<TemplateManifest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch manifest on mount
  useEffect(() => {
    fetchTemplateManifest()
      .then(setTemplates)
      .catch((err: Error) => setError(err.message));
  }, []);

  // 2. Fetch raw HTML string when a specific template is selected
  const handleSelect = async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const html = await fetchTemplateContent(id);
      onTemplateLoad(id, html);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Auto-load the first template if none is selected yet
  useEffect(() => {
    if (templates.length > 0 && !selectedId && !isLoading) {
      void handleSelect(templates[0].id);
    }
  }, [templates, selectedId]);

  if (error) {
    return (
      <div className="text-red-400 text-sm font-mono p-2 border border-red-900 rounded bg-red-950/30">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2 w-full">
      <label className="text-sm font-semibold text-slate-300">{label}</label>
      <select
        value={selectedId || ''}
        onChange={(e) => void handleSelect(e.target.value)}
        disabled={isLoading || templates.length === 0}
        className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm disabled:opacity-50 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}