// File: services/platform/esignature-service/client/src/widgets/SignatureOverlay.tsx
import { useRef, useState, useEffect } from 'react';
import '@shared/styles';

interface SignatureOverlayProps {
  pdfBlobUrl: string;
  onSuccess: (signedPdfBlobUrl: string) => void;
  onCancel: () => void;
}

export default function SignatureOverlay({
  pdfBlobUrl,
  onSuccess,
  onCancel,
}: Readonly<SignatureOverlayProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.lineWidth = 2; // Thin line
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000'; // Black ink
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
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    setIsSubmitting(true);
    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      const signatureImageBase64 = signatureDataUrl.split(',')[1];

      const pdfResponse = await fetch(pdfBlobUrl);
      const pdfBlob = await pdfResponse.blob();
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      const signResponse = await fetch('/api/v1/esign/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': `esign-req-${Date.now()}`
        },
        body: JSON.stringify({
          pdfBase64,
          signatureImageBase64,
        }),
      });

      if (!signResponse.ok) {
        throw new Error(`Server returned ${signResponse.status}`);
      }

      const signedPdfBlob = await signResponse.blob();
      const signedPdfUrl = URL.createObjectURL(signedPdfBlob);
      
      onSuccess(signedPdfUrl);

    } catch (error) {
      console.error('Signature processing failed:', error);
      alert('Failed to sign the document. Check the console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      {/* Compact Modal Card */}
      <div className="w-full max-w-lg h-[400px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col justify-between p-6">
        
        {/* Header */}
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

        {/* Signature Canvas Area */}
        <div className={`flex-1 my-3 border-2 border-dashed border-blue-500/50 rounded-xl bg-white relative overflow-hidden ${isSubmitting ? 'cursor-wait opacity-80' : 'cursor-crosshair'}`}>
          
          {/* Light gray writing guide line at ~66% (2/3) down */}
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

        {/* Action Buttons */}
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