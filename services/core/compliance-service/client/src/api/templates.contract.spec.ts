// File: services/core/compliance-service/client/src/api/templates.contract.spec.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { apiClient } from './client';
import path from 'node:path';
import { z } from 'zod';
import { TemplateDTOSchema, TemplateManifestSchema, TemplateDraftResponseSchema } from 'compliance-shared';
import { mockFromSchema, SHA256_HEX } from '@shared/testing';

const { like, arrayContaining } = MatchersV3;

const templateName = 'Asset Transfer Authorization';
const PACT_SEED = 1;

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
          like(mockFromSchema(TemplateManifestSchema, { name: templateName, type: 'AUTHORIZATION' }, { seed: PACT_SEED }))
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
      const body = z.array(TemplateManifestSchema).parse(response.body);
      expect(body).toHaveLength(1);
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
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: like(
          mockFromSchema(TemplateDTOSchema, {
            id: templateId,
            name: templateName,
            type: 'AUTHORIZATION',
            rawHTML: '<div>Authorization Form HTML</div>',
          }, { seed: PACT_SEED }),
        ),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.getTemplate({
        params: { id: templateId },
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/compliance/api/v1`,
        },
      });

      expect(response.status).toBe(200);
      const body = TemplateDTOSchema.parse(response.body);
      expect(body.id).toBe(templateId);
      expect(body.rawHTML).toContain('Authorization Form HTML');
    });
  });

  it('creates a template draft and returns StorageArtifact response with pre-signed URL', async () => {
    const templateId = 'asset-transfer-authorization';
    const draftRequestBody = { data: { requisitionNumber: '', items: [] } };
    const draftResponse = mockFromSchema(TemplateDraftResponseSchema, {
      documentName: templateId,
      // Optional in the schema; the pact must only require keys the provider guarantees to return.
      jobId: undefined,
      fileHash: SHA256_HEX,
      presignedUrl: 'http://localhost:9000/dsap/test-document.pdf?signature=xyz',
    }, { seed: PACT_SEED });

    provider
      .given(`template with ID ${templateId} exists for drafting`)
      .uponReceiving(`a request to create a draft for template ${templateId}`)
      .withRequest({
        method: 'POST',
        path: `/compliance/api/v1/templates/${templateId}/drafts`,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: like(draftRequestBody),
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: like(draftResponse),
      });

    await provider.executeTest(async (mockServer) => {
      const response = await apiClient.createTemplateDraft({
        params: { id: templateId },
        body: draftRequestBody,
        overrideClientOptions: {
          baseUrl: `${mockServer.url}/compliance/api/v1`,
        },
      });

      expect(response.status).toBe(201);
      const body = TemplateDraftResponseSchema.parse(response.body);
      expect(body.documentName).toBe(templateId);
      expect(body.presignedUrl).toBeDefined();
    });
  });
});