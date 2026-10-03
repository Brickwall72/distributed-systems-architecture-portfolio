// File: services/platform/pdf-generator/client/src/hooks/usePdfGenerator.ts
import { useState, useCallback } from 'react';
import { generatePdf } from '../api/generatePdf';

export interface UsePdfGeneratorOptions {
  fileName?: string;
  onSuccess?: (blobUrl: string) => void;
  onError?: (error: Error) => void;
}

export function usePdfGenerator(options: UsePdfGeneratorOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(async (htmlPayload: string) => {
    if (!htmlPayload) return;

    setIsGenerating(true);
    setError(null);

    try {
      const blobUrl = await generatePdf(htmlPayload);

      if (options.onSuccess) {
        options.onSuccess(blobUrl);
      } else {
        // Fallback automatic trigger
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = options.fileName || 'document.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      return blobUrl;
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('PDF generation failed');
      setError(parsedError);
      options.onError?.(parsedError);
      throw parsedError;
    } finally {
      setIsGenerating(false);
    }
  }, [options.fileName, options.onSuccess, options.onError]);

  return {
    generate,
    isGenerating,
    error,
  };
}