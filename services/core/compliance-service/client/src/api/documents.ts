// File: services/core/compliance-service/client/src/api/documents.ts
import { z } from 'zod';
import { ComplianceDocumentSchema, ComplianceDocument } from '../contracts';
import { getApiBaseUrl } from './client-config';

/**
 * Fetches and validates the raw dataset of compliance documents.
 */
export async function fetchDocuments(): Promise<ComplianceDocument[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/compliance/api/v1/documents/`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch documents dataset: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Enforces the contract at runtime
  return z.array(ComplianceDocumentSchema).parse(data);
}