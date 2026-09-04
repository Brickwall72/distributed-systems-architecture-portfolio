// File: packages/shared/ui/src/components/DocumentViewer.test.tsx
import 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DocumentViewer from './DocumentViewer';

describe('DocumentViewer Component', () => {
  it('renders raw HTML securely using srcDoc when contentType is html', () => {
    const mockHtml = '<h1>Test Content</h1>';
    render(<DocumentViewer content={mockHtml} contentType="html" />);
    
    const iframe = screen.getByTitle('Document Viewer');
    expect(iframe).toHaveAttribute('srcDoc', mockHtml);
    expect(iframe).not.toHaveAttribute('src');
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
  });

  it('renders binary source using src when contentType is pdf', () => {
    const mockBlobUrl = 'blob:http://localhost/test-blob-123';
    render(<DocumentViewer content={mockBlobUrl} contentType="pdf" />);
    
    const iframe = screen.getByTitle('Document Viewer');
    expect(iframe).toHaveAttribute('src', mockBlobUrl);
    expect(iframe).not.toHaveAttribute('srcDoc');
    expect(iframe).not.toHaveAttribute('sandbox');
  });

  it('applies custom class names and custom titles correctly', () => {
    render(
      <DocumentViewer 
        content="test" 
        contentType="html" 
        className="custom-border-class" 
        title="Custom Title" 
      />
    );
    
    const iframe = screen.getByTitle('Custom Title');
    const wrapper = iframe.parentElement;
    expect(wrapper).toHaveClass('custom-border-class');
  });

  it('renders the custom placeholder when content is missing or null', () => {
    render(
      <DocumentViewer 
        content={null} 
        contentType="pdf" 
        placeholder={<div data-testid="custom-placeholder">Awaiting Operational Command</div>} 
      />
    );
    
    expect(screen.getByTestId('custom-placeholder')).toBeInTheDocument();
    expect(screen.queryByTitle('Document Viewer')).not.toBeInTheDocument();
  });
});