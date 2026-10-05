// File: services/platform/pdf-generator/client/src/api/generatePdf.ts

export interface GeneratePdfOptions {
  baseUrl?: string;
  documentId?: string;
  entityId?: string;
  documentType?: string;
  customPath?: string;
}

/**
 * Sends HTML content to the PDF generator service and returns an Object URL for the resulting PDF Blob.
 */
export async function generatePdf(
  htmlPayload: string,
  options: GeneratePdfOptions = {}
): Promise<string> {
  const { baseUrl = '', documentId, entityId, documentType, customPath } = options;

  const response = await fetch(`${baseUrl}/pdf/api/v1/generator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html: htmlPayload,
      documentId,
      entityId,
      documentType,
      customPath,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate PDF: ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}