// File: services/platform/esignature-service/client/src/components/SignatureOverlay.tsx
import { useRef, useState, useEffect } from 'react';
import { signDocument } from '../api';

interface SignatureOverlayProps {
  pdfBlobUrl: string;
  documentId: string;
  signerId: string;
  entityId: string;
  customPath?: string;
  documentType?: string;
  onSuccess: (signedPdfBlobUrl: string) => void;
  onCancel: () => void;
}

export default function SignatureOverlay({
  pdfBlobUrl,
  documentId,
  signerId,
  entityId,
  customPath,
  documentType,
  onSuccess,
  onCancel,
}: Readonly<SignatureOverlayProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || 200;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSubmitting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
    setErrorMessage(null);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isSubmitting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas || isSubmitting) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      const signedPdfUrl = await signDocument({
        pdfBlobUrl,
        signatureDataUrl,
        documentId,
        signerId,
        entityId,
        customPath,
        documentType,
      });

      onSuccess(signedPdfUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to sign document.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg h-[420px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col justify-between p-6">
        <div className="flex justify-between items-center text-white">
          <span className="text-sm font-semibold tracking-wide">Draw Signature on Document</span>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs text-slate-400 hover:text-white disabled:opacity-50 transition"
          >
            Cancel
          </button>
        </div>

        {errorMessage && (
          <div role="alert" className="mt-2 p-2 bg-red-950/80 border border-red-500/50 rounded text-red-200 text-xs">
            {errorMessage}
          </div>
        )}

        <div
          className={`flex-1 my-3 border-2 border-dashed border-blue-500/50 rounded-xl bg-white relative overflow-hidden ${
            isSubmitting ? 'cursor-wait opacity-80' : 'cursor-crosshair'
          }`}
        >
          <div className="absolute left-8 right-8 top-[75%] border-b border-slate-600 pointer-events-none z-0" />

          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full h-full rounded-xl bg-transparent relative z-10"
          />

          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs text-center px-4 z-20">
              Sign here using your mouse or touch screen
            </div>
          )}
        </div>

        <div className="flex justify-end items-center gap-3">
          <button
            onClick={handleClear}
            disabled={!hasDrawn || isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition"
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasDrawn || isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition shadow-lg flex items-center gap-2"
          >
            {isSubmitting ? 'Signing...' : 'Submit & Sign PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}