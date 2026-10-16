// File: services/platform/esignature-service/client/src/components/SignatureOverlay.tsx
import { useRef, useState, useEffect } from 'react';
import { Button } from '@shared/ui-components';

interface SignatureOverlayProps {
  isSubmitting?: boolean;
  onSign: (signatureDataUrl: string) => Promise<void>;
  onCancel: () => void;
}

export default function SignatureOverlay({
  isSubmitting = false,
  onSign,
  onCancel,
}: Readonly<SignatureOverlayProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitting = isSubmitting || localSubmitting;

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
    if (submitting) return;
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
    if (!isDrawing || submitting) return;
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
    if (!canvas || submitting) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    setLocalSubmitting(true);
    setErrorMessage(null);

    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      await onSign(signatureDataUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to sign document.';
      setErrorMessage(msg);
    } finally {
      setLocalSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg h-[420px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col justify-between p-6">
        <div className="flex justify-between items-center text-white">
          <span className="text-sm font-semibold tracking-wide">Draw Signature on Document</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
            className="text-xs text-slate-400 hover:text-white h-auto py-1 px-2"
          >
            Cancel
          </Button>
        </div>

        {errorMessage && (
          <div role="alert" className="mt-2 p-2 bg-red-950/80 border border-red-500/50 rounded text-red-200 text-xs">
            {errorMessage}
          </div>
        )}

        <div
          className={`flex-1 my-3 border-2 border-dashed border-blue-500/50 rounded-xl bg-white relative overflow-hidden ${
            submitting ? 'cursor-wait opacity-80' : 'cursor-crosshair'
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
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClear}
            disabled={!hasDrawn || submitting}
            className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs py-2 px-4"
          >
            Clear
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={submitting}
            disabled={!hasDrawn || submitting}
            className="bg-blue-600 hover:bg-blue-500 text-xs py-2 px-4 shadow-lg"
          >
            Submit & Sign PDF
          </Button>
        </div>
      </div>
    </div>
  );
}