// File: services/platform/esignature-service/client/src/api/esignApi.ts

import { SignDocumentRequest, SignDocumentRequestSchema } from '@contracts/esign';

export interface SignDocumentParams {
  pdfBlobUrl: string;
  signatureDataUrl: string;
  documentId: string;
  signerId: string;
  entityId: string;
  customPath?: string;
  documentType?: string;
}

async function fetchUrlAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch source document (${response.status})`);
  }
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = (reader.result as string) || '';
      const base64String = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error('Failed to parse document blob into Base64'));
    reader.readAsDataURL(blob);
  });
}

export async function signDocument(params: SignDocumentParams, baseUrl = ''): Promise<string> {
  const pdfBase64 = await fetchUrlAsBase64(params.pdfBlobUrl);
  const signatureImageBase64 = params.signatureDataUrl.includes(',')
    ? params.signatureDataUrl.split(',')[1]
    : params.signatureDataUrl;

  const rawPayload: SignDocumentRequest = {
    pdfBase64,
    signatureImageBase64,
    documentId: params.documentId,
    signerId: params.signerId,
    entityId: params.entityId,
    customPath: params.customPath,
    documentType: params.documentType,
  };

  const validatedPayload = SignDocumentRequestSchema.parse(rawPayload);

  const correlationId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? `esign-req-${crypto.randomUUID()}`
    : `esign-req-${Date.now()}`;

  const response = await fetch(`${baseUrl}/esign/api/v1/signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(validatedPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server returned status ${response.status}`);
  }

  const signedPdfBlob = await response.blob();
  return URL.createObjectURL(signedPdfBlob);
}