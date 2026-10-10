// File: services/core/compliance-service/client/src/utils/mswHandlers.ts
import { http, HttpResponse } from 'msw';

export interface TemplateManifest {
  readonly id: string;
  readonly name: string;
}

export const mockTemplateManifest: TemplateManifest[] = [
  {
    id: 'asset-transfer-authorization',
    name: 'DD Form 1149 (Asset Transfer Authorization)',
  },
  {
    id: 'asset-transfer-receipt',
    name: 'Asset Transfer Receipt',
  },
  {
    id: 'contract-test-bare',
    name: 'Test Bare Compliance Contract',
  },
];

export const complianceApiHandlers = [
  // 1. Fetch template listing manifest (matches any host ending in /templates)
  http.get(/\/compliance\/api\/v1\/templates$/, () => {
    return HttpResponse.json(mockTemplateManifest);
  }),

  // 2. Fetch raw HTML content for a specific template
  http.get(/\/compliance\/api\/v1\/templates\/(?<templateId>[^/]+)$/, ({ params }) => {
    const { templateId } = params;

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 1.5rem; color: #0f172a; background: #ffffff;">
        <h2 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem;">
          Compliance Form: ${String(templateId).toUpperCase()}
        </h2>
        <p style="color: #64748b; font-size: 0.875rem;">Requisition Ref: {{requisitionNumber}}</p>
        <hr style="margin: 1rem 0; border-color: #e2e8f0;" />
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <strong style="display: block; color: #475569; font-size: 0.75rem; text-transform: uppercase;">Releasing Entity</strong>
            <span style="font-size: 0.95rem;">{{releasingEntityName}}</span>
          </div>
          <div>
            <strong style="display: block; color: #475569; font-size: 0.75rem; text-transform: uppercase;">Receiving Entity</strong>
            <span style="font-size: 0.95rem;">{{receivingEntityName}}</span>
          </div>
        </div>

        <div style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 0.375rem;">
          <strong style="display: block; color: #475569; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Transferred Asset Details</strong>
          <p style="margin: 0.25rem 0;"><strong>Nomenclature:</strong> {{nomenclature}}</p>
          <p style="margin: 0.25rem 0;"><strong>Serial Number:</strong> {{serialNumber}}</p>
          <p style="margin: 0.25rem 0;"><strong>Transfer Date:</strong> {{transferDate}}</p>
        </div>
      </div>
    `;

    return HttpResponse.text(htmlContent);
  }),
];