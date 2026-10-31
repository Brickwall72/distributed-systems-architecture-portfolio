// File: packages/ui/src/components/DocumentViewer/DocumentViewer.unit.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DocumentViewer from './DocumentViewer';

describe('DocumentViewer Component', () => {
  it('renders raw HTML securely using srcDoc when contentType is html', () => {
    const mockHtml = '<h1>Test Compliance Document</h1>';
    render(<DocumentViewer content={mockHtml} contentType="html" />);
    
    const iframe = screen.getByTitle('Document Viewer');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('srcdoc', mockHtml);
    expect(iframe).not.toHaveAttribute('src');
  });

  it('renders binary source using src when contentType is pdf', () => {
    const mockBlobUrl = 'blob:http://localhost/test-blob-123';
    render(<DocumentViewer content={mockBlobUrl} contentType="pdf" title="PDF Viewer" />);
    
    const iframe = screen.getByTitle('PDF Viewer');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', mockBlobUrl);
    expect(iframe).not.toHaveAttribute('srcdoc');
  });

  it('applies custom class names to the root wrapper container correctly', () => {
    const { container } = render(
      <DocumentViewer 
        content="<p>content</p>" 
        contentType="html" 
        className="custom-viewer-wrapper" 
      />
    );
    
    const rootDiv = container.firstChild;
    expect(rootDiv).toHaveClass('custom-viewer-wrapper');
  });

  it('applies pointer-events-none and select-none when isSigningActive is true', () => {
    render(
      <DocumentViewer 
        content="<p>signing</p>" 
        contentType="html" 
        isSigningActive={true} 
      />
    );
    
    const iframe = screen.getByTitle('Document Viewer');
    expect(iframe).toHaveClass('pointer-events-none');
    expect(iframe).toHaveClass('select-none');
  });

  it('renders default placeholder when content is missing or null', () => {
    render(<DocumentViewer content={null} contentType="html" />);
    
    expect(screen.getByText('No document loaded')).toBeInTheDocument();
    expect(screen.queryByTitle('Document Viewer')).not.toBeInTheDocument();
  });

  it('renders custom placeholder when provided and content is null', () => {
    render(
      <DocumentViewer 
        content={undefined} 
        contentType="pdf" 
        placeholder={<div data-testid="custom-placeholder">Awaiting Document Selection</div>} 
      />
    );
    
    expect(screen.getByTestId('custom-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Document Selection')).toBeInTheDocument();
    expect(screen.queryByTitle('Document Viewer')).not.toBeInTheDocument();
  });

  it('renders children slot contents correctly', () => {
    render(
      <DocumentViewer content="<p>test</p>" contentType="html">
        <div data-testid="signature-overlay">Signature Canvas Overlay</div>
      </DocumentViewer>
    );
    
    expect(screen.getByTestId('signature-overlay')).toBeInTheDocument();
  });
});