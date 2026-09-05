// File: services/platform/pdf-generator/client/src/widgets/GeneratePdfButton.tsx
import React, { useState } from 'react';
import '@shared/styles';

interface GeneratePdfButtonProps {
  /** The raw HTML string to send to the engine */
  htmlPayload: string;
  fileName?: string;
  buttonText?: string;
  onSuccess?: (blobUrl: string) => void;
  onError?: (error: Error) => void;
}

export default function GeneratePdfButton ({
  htmlPayload,
  fileName = 'document.pdf',
  buttonText = 'Generate PDF',
  onSuccess,
  onError,
}: Readonly<GeneratePdfButtonProps>): React.ReactElement {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/v1/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlPayload }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate PDF: ${response.statusText}`);
      }

      // Convert the binary stream into a browser Object URL
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (onSuccess) {
        // If the host shell provides an onSuccess handler (like DocumentViewer),
        // pass the blobUrl to it and skip the automatic download.
        onSuccess(blobUrl);
      } else {
        // Fallback: Trigger automatic download only if no shell handler is attached
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={isGenerating || !htmlPayload}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {isGenerating ? 'Generating...' : buttonText}
    </button>
  );
};