// File: services/core/compliance-service/server/src/routes/documents/documents.route.contract-boundary.unit.test.ts
import { zocker } from 'zocker';
import { SignDocumentCommandSchema, SignDocumentResponseSchema } from '@contracts/esign';
import { signDocumentApiRequestSchema } from 'compliance-shared';
import { insertDataSchema } from '../../repositories';

describe('compliance documents: HTTP/API schemas vs shared esign messaging contract', () => {
  it('the API request is a superset of the shared esign command', () => {
    for (const key of Object.keys(SignDocumentCommandSchema.shape)) {
      expect(Object.keys(signDocumentApiRequestSchema.shape), `API request missing "${key}"`).toContain(key);
    }
  });

  it('every API request produces a valid shared esign command', () => {
    for (let i = 0; i < 25; i++) {
      const body = zocker(signDocumentApiRequestSchema).generate();
      expect(SignDocumentCommandSchema.safeParse(body).success).toBe(true);
    }
  });

  it('the shared esign response carries every field the local insert schema needs from it', () => {
    const fromResponse = ['storageBucket', 'storageKey', 'fileHash'];
    for (const key of fromResponse) {
      expect(Object.keys(SignDocumentResponseSchema.shape)).toContain(key);
      expect(Object.keys(insertDataSchema.shape)).toContain(key);
    }
  });
});
