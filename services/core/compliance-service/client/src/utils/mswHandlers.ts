// File: services/core/compliance-service/client/src/utils/mswHandlers.ts
import { http, HttpResponse } from 'msw';
import type { TemplateManifest } from '../api';

export const mockTemplateManifest: TemplateManifest[] = [
  { id: 'dd-1149', name: 'DD Form 1149 (Requisition/Transfer)' },
  { id: 'form-4417', name: 'Form 4417 Compliance Audit' },
];

export const complianceApiHandlers = [
  // 1. Match fetchTemplateManifest endpoint
  http.get('*/compliance/api/v1/templates', () => {
    return HttpResponse.json(mockTemplateManifest);
  }),

  // 2. Match fetchTemplateContent endpoint
  http.get('*/compliance/api/v1/templates/:templateId', ({ params }) => {
    const { templateId } = params;
    return HttpResponse.text(`
      <div style="font-family: sans-serif; padding: 1.5rem; color: #0f172a;">
        <h2 style="font-size: 1.25rem; font-weight: bold;">Compliance Form: ${String(templateId).toUpperCase()}</h2>
        <hr style="margin: 1rem 0;" />
        <p><strong>Organization:</strong> {{organizationName}}</p>
        <p><strong>Transfer Ref:</strong> {{transferId}}</p>
        <p><strong>Security Classification:</strong> {{securityLevel}}</p>
      </div>
    `);
  }),
];