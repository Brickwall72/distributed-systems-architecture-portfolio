// File: services/core/compliance-service/client/src/ComplianceWidget.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import { TemplateSelector } from './widgets';

const meta: Meta<typeof TemplateSelector> = {
  title: 'Widgets/Template Selector',
  component: TemplateSelector,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof TemplateSelector>;

// Stateful wrapper component to simulate real user selection and preview feedback
const InteractiveTemplateSelectorWrapper = (args: any) => {
  const [selectedId, setSelectedId] = useState<string>(args.selectedId || 'dd-1149');
  const [lastLoadedHtml, setLastLoadedHtml] = useState<string>('');

  return (
    <div className="flex flex-col gap-4 w-[400px] p-6 bg-slate-950 rounded-xl border border-slate-800 text-slate-100 shadow-xl">
      <TemplateSelector
        {...args}
        selectedId={selectedId}
        onTemplateLoad={(id, html) => {
          setSelectedId(id);
          setLastLoadedHtml(html);
          args.onTemplateLoad?.(id, html);
        }}
      />
      
      {/* Live debugging panel to prove dynamic behavior */}
      <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono">
        <div className="text-slate-400 mb-1">State Feedback:</div>
        <div><strong className="text-blue-400">Selected ID:</strong> {selectedId}</div>
        <div><strong className="text-blue-400">Fetched HTML Size:</strong> {lastLoadedHtml.length} characters</div>
      </div>
    </div>
  );
};

export const InteractiveFormSelector: Story = {
  render: (args) => <InteractiveTemplateSelectorWrapper {...args} />,
  args: {
    label: 'Compliance Form Definition',
    selectedId: 'dd-1149',
  },
  parameters: {
    msw: {
      handlers: [
        // Mock the template manifest endpoint
        http.get('/compliance/api/v1/templates', () => {
          return HttpResponse.json([
            { id: 'dd-1149', name: 'DD Form 1149 (Requisition & Invoice)' },
            { id: 'dd-250', name: 'DD Form 250 (Material Inspection & Receiving)' },
            { id: 'custom-audit', name: 'Custom Field Audit Checklist v2' },
          ]);
        }),
        // Mock individual template HTML content dynamically based on ID
        http.get('/compliance/api/v1/templates/:id', ({ params }) => {
          const { id } = params;
          
          if (id === 'dd-250') {
            return new HttpResponse(
              '<!DOCTYPE html><html><body><h1>DD-250 Receiving Document</h1><p>Inspection for asset: {{nomenclature}}</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          if (id === 'custom-audit') {
            return new HttpResponse(
              '<!DOCTYPE html><html><body><h1>Custom Audit Checklist</h1><p>Entity: {{releasingEntityName}}</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new HttpResponse(
            '<!DOCTYPE html><html><body><h1>DD-1149 Requisition</h1><p>Transfer from {{releasingEntityName}} to {{receivingEntityName}}</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }),
      ],
    },
  },
};