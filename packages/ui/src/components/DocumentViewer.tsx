// File: packages/ui/src/components/DocumentViewer.tsx
import React from 'react';
import '@shared/styles';
import { cn } from '..';

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
  // If no content is provided, render the placeholder inside the frame container
  if (!content) {
    return (
      <div className={cn("w-full flex flex-col items-center justify-center relative overflow-hidden", className)}>
        {placeholder || (
          <div className="text-slate-500 font-mono text-sm">No document loaded</div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col relative overflow-hidden", className)}>
      {contentType === 'html' ? (
        // Renders raw HTML securely isolated from the parent app's CSS
        <iframe
          title={title}
          srcDoc={content}
          className={cn(
            "w-full h-full border-0 flex-1 transition-all",
            isSigningActive && "pointer-events-none select-none"
          )}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      ) : (
        // Renders the generated PDF Blob URL
        <iframe
          title={title}
          src={content}
          className={cn(
            "w-full h-full border-0 flex-1 transition-all",
            isSigningActive && "pointer-events-none select-none"
          )}
        />
      )}

      {/* Slot for overlay widgets (e.g., SignatureOverlayWidget) */}
      {children}
    </div>
  );
}