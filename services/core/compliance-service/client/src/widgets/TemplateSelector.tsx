// File: services/core/compliance-service/client/src/widgets/TemplateSelector.tsx
import { useState, useEffect } from 'react';
import '@shared/styles';

interface TemplateManifest {
  id: string;
  name: string;
}

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

  // 1. Fetch the manifest of available templates on mount
  useEffect(() => {
    fetch('/compliance/api/v1/templates')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch templates');
        return res.json();
      })
      .then((data: TemplateManifest[]) => setTemplates(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  // 2. Fetch the raw HTML string when a specific template is selected
  const handleSelect = async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/compliance/api/v1/templates/${id}`);
      if (!res.ok) throw new Error('Failed to fetch template content');
      
      const html = await res.text();
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
      handleSelect(templates[0].id);
    }
  }, [templates, selectedId]);

  if (error) {
    return <div className="text-red-400 text-sm font-mono p-2 border border-red-900 rounded bg-red-950/30">Error: {error}</div>;
  }

  return (
    <div className="flex flex-col space-y-2 w-full">
      <label className="text-sm font-semibold text-slate-300">{label}</label>
      <select
        value={selectedId || ''}
        onChange={(e) => handleSelect(e.target.value)}
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