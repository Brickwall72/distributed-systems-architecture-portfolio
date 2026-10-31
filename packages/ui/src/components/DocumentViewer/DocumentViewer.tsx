// File: packages/ui/src/components/DocumentViewer/DocumentViewer.tsx
import React from 'react';
import '@shared/styles';
import { cn } from '../../lib';

interface DocumentViewerProps {
  /** Can be raw HTML string (for preview) or a Blob URL (for final PDF) */
  content?: string | null;
  contentType: 'html' | 'pdf';
  title?: string;
  className?: string;
  placeholder?: React.ReactNode;
  /** Locks iframe mouse interactions when drawing a signature overlay */
  isSigningActive?: boolean;
  /** Slot for overlay widgets like SignatureOverlayWidget */
  children?: React.ReactNode;
}

export default function DocumentViewer({
  content,
  contentType,
  title = 'Document Viewer',
  className = '',
  placeholder,
  isSigningActive = false,
  children,
}: Readonly<DocumentViewerProps>): React.ReactElement {
  if (!content) {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center relative overflow-hidden rounded-xl min-h-0", className)}>
        {placeholder || (
          <div className="text-slate-500 font-mono text-sm">No document loaded</div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col relative overflow-hidden rounded-xl min-h-0", className)}>
      {/* Absolute positioning wrapper forces containment inside rounded bounds */}
      <div className="relative flex-1 w-full h-full overflow-hidden rounded-xl min-h-0">
        {contentType === 'html' ? (
          <iframe
            title={title}
            srcDoc={content}
            className={cn(
              "absolute inset-0 w-full h-full border-0 block transition-all",
              isSigningActive && "pointer-events-none select-none"
            )}
          />
        ) : (
          <iframe
            title={title}
            src={content}
            className={cn(
              "absolute inset-0 w-full h-full border-0 block transition-all",
              isSigningActive && "pointer-events-none select-none"
            )}
          />
        )}
      </div>

      {/* Slot for overlay widgets (e.g., SignatureOverlayWidget) */}
      {children}
    </div>
  );
}