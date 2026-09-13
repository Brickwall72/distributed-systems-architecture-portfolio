// File: services/core/compliance-service/client/src/api/save-document.ts

export async function saveDocument(
  documentUrl: string,
  // correlationId: string
): Promise<void> {
  // 1. Fetch the binary blob from the local object URL
  const response = await fetch(documentUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch local PDF blob for persistence.');
  }
  const blob = await response.blob();

  // 2. Convert blob to a base64 string for the backend payload
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result?.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to parse base64 string from blob reader.'));
      } else {
        resolve(base64);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  // 3. POST the payload to the compliance service backend (MinIO + Postgres)
  const apiResponse = await fetch('/api/v1/compliance/documents/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'x-correlation-id': correlationId,
    },
    body: JSON.stringify({
      pdfBase64: base64Data,
      documentType: 'transfer-approval',
    }),
  });

  if (!apiResponse.ok) {
    const errorBody = await apiResponse.json().catch(() => ({}));
    throw new Error(errorBody.error || `Server responded with status ${apiResponse.status}`);
  }
}