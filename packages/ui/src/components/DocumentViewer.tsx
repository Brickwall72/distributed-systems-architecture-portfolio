// File: packages/ui/src/components/DocumentViewer.tsx
import React from 'react';
import '@shared/styles';
import { cn } from '../lib/utils';

interface DocumentViewerProps {
  /** Can be raw HTML string (for preview) or a Blob URL (for final PDF) */
  content?: string | null;
  contentType: 'html' | 'pdf';
  title?: string;
  className?: string;
  placeholder?: React.ReactNode;
}

export default function DocumentViewer({
  content,
  contentType,
  title = 'Document Viewer',
  className = '',
  placeholder,
}: Readonly<DocumentViewerProps>): React.ReactElement {
  // If no content is provided, render the placeholder inside the frame container
  if (!content) {
    return (
      <div className={cn("w-full flex flex-col items-center justify-center relative overflow-hidden", className)}>
        {placeholder || (
          <div className="text-slate-500 font-mono text-sm">No document loaded</div>
        )}
      </div>
    );
  }
  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
      {contentType === 'html' ? (
        // Renders raw HTML securely isolated from the parent app's CSS
        <iframe
          title={title}
          srcDoc={content}
          className="w-full h-full border-0 flex-1"
          sandbox="allow-same-origin"
        />
      ) : (
        // Renders the generated PDF Blob URL
        <iframe
          title={title}
          src={content}
          className="w-full h-full border-0 flex-1"
        />
      )}
    </div>
  );
}