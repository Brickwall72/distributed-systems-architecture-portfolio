// File: services/platform/pdf-generator/client/src/api/generatePdf.ts

/**
 * Sends HTML content to the PDF generator service and returns an Object URL for the resulting PDF Blob.
 */
export async function generatePdf(htmlPayload: string, baseUrl: string = ''): Promise<string> {
  const response = await fetch(`${baseUrl}/pdf/api/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: htmlPayload }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate PDF: ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}