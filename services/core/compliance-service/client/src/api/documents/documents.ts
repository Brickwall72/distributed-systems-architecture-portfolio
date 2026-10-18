// File: services/core/compliance-service/client/src/api/documents/documents.ts
import { z } from 'zod';
import { apiClient } from '../client';
import { Document, DocumentSchema } from 'compliance-shared';

/**
 * Fetches and validates the raw dataset of documents via ts-rest apiClient.
 */
export async function fetchDocuments(): Promise<Document[]> {
  const response = await apiClient.getDocuments();

  if (response.status !== 200) {
    const errBody = response.body as { error?: string; message?: string };
    throw new Error(errBody?.error || errBody?.message || `Failed to fetch documents dataset: HTTP ${response.status}`);
  }

  // Enforces the contract at runtime
  return z.array(DocumentSchema).parse(response.body) as Document[];
}