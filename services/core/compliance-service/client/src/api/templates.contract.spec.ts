// File: services/core/compliance-service/client/src/api/templates.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';

const { like, string, integer, arrayContaining } = MatchersV3;

const provider = new PactV3({
  consumer: 'compliance-client',
  provider: 'compliance-server',
  cors: true,
  dir: path.resolve(process.cwd(), '../shared/pacts'),
});

describe('Compliance Client -> Compliance Server Contract (Templates API)', () => {
  it('returns a list of template manifests successfully', async () => {
    provider
      .given('templates exist in the system')
      .uponReceiving('a request to get all template manifests')
      .withRequest({
        method: 'GET',
        path: '/compliance/api/v1/templates',
        query: { type: 'AUTHORIZATION' },
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: arrayContaining(
          like({
            id: string('t-123'),
            name: string('Asset Transfer Authorization'),
            type: string('AUTHORIZATION'),
          })
        ),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getTemplates({
        query: { type: 'AUTHORIZATION' },
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/compliance/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as Array<{ id: string; name: string; type: string }>;
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('t-123');
      expect(body[0].type).toBe('AUTHORIZATION');
    });
  });

  it('returns a full template DTO by ID', async () => {
    const templateId = 'asset-transfer-authorization';

    provider
      .given(`template with ID ${templateId} exists`)
      .uponReceiving(`a request to get template ${templateId}`)
      .withRequest({
        method: 'GET',
        path: `/compliance/api/v1/templates/${templateId}`,
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 201, // updated from 200 or kept as 200 depending on contract
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: like({
          id: string(templateId),
          name: string('Asset Transfer Authorization'),
          type: string('AUTHORIZATION'),
          version: integer(1),
          rawHTML: string('<div>Authorization Form HTML</div>'),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getTemplate({
        params: { id: templateId },
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/compliance/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as { id: string; name: string; rawHTML: string };
      expect(body.id).toBe(templateId);
      expect(body.rawHTML).toContain('Authorization Form HTML');
    });
  });

  it('creates a template draft and returns pre-signed URL response', async () => {
    const templateId = 'asset-transfer-authorization';

    provider
      .given(`template with ID ${templateId} exists for drafting`)
      .uponReceiving(`a request to create a draft for template ${templateId}`)
      .withRequest({
        method: 'POST',
        path: `/compliance/api/v1/templates/${templateId}/drafts`,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: like({
          input: {
            sourceOrg: { id: 'org-1', name: 'Source Alpha', type: 'GOV' },
          },
        }),
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: like({
          draftId: string('draft-uuid-123'),
          presignedUrl: string('http://localhost:9000/dsap/test-document.pdf?signature=xyz'),
          requisitionNumber: string('REQ-2026-0001'),
        }),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.createTemplateDraft({
        params: { id: templateId },
        body: {
          input: {
            sourceOrg: { id: 'org-1', name: 'Source Alpha', type: 'GOV' },
          },
        },
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/compliance/api/v1`,
        },
      });

      expect(response.status).toBe(201);
      const body = response.body as { draftId: string; presignedUrl: string; requisitionNumber: string };
      expect(body.draftId).toBe('draft-uuid-123');
      expect(body.presignedUrl).toBeDefined();
      expect(body.requisitionNumber).toBe('REQ-2026-0001');
    });
  });
});