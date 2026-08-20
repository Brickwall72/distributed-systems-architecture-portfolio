import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PDFViewerWidget } from './index.js';

// Deep Dependency Mocking: Prevent pdfjs-dist from attempting to run browser-native Web Workers in memory
const mockPdfjs = vi.hoisted(() => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({ numPages: 42 })
  })
}));

vi.mock('pdfjs-dist', () => ({
  default: mockPdfjs
}));

describe('TDD Unit Test: Cross-Platform PDF Viewer Widget Component', () => {
  let mockContainer: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    // Scaffold a lightweight in-memory DOM container model using standard primitives
    mockContainer = {
      innerHTML: '',
      appendChild: vi.fn()
    } as unknown as HTMLElement;
  });

  it('should forcefully throw a validation crash error if initialized without a document identifier', () => {
    expect(() => {
      new PDFViewerWidget({
        element: mockContainer,
        documentId: ''
      });
    }).toThrow('PDFViewerWidget: Missing required parameter documentId');
  });

  it('should fall back to the canonical platform routing URL if no stream provider override is supplied', () => {
    const widget = new PDFViewerWidget({
      element: mockContainer,
      documentId: 'flight-plan-alpha.pdf'
    });

    expect(widget.getTargetUrl()).toBe('/v1/stream?documentId=flight-plan-alpha.pdf');
  });

  it('should gracefully adapt its stream ingestion path if an explicit network provider override is passed', () => {
    const widget = new PDFViewerWidget({
      element: mockContainer,
      documentId: 'handover-manifest.pdf',
      streamUrl: 'https://platform.local'
    });

    expect(widget.getTargetUrl()).toBe('https://platform.local?documentId=handover-manifest.pdf');
  });

  it('should securely trigger pdfjs data stream loading tasks and resolve total asset properties', async () => {
    const widget = new PDFViewerWidget({
      element: mockContainer,
      documentId: 'secure-flight-log.pdf'
    });

    const pageCount = await widget.initializeViewEngine();

    // Verify widget behavior integrates perfectly with pdfjs core methods
    expect(pageCount).toBe(42);
    expect(mockPdfjs.getDocument).toHaveBeenCalledWith({ 
      url: '/v1/stream?documentId=secure-flight-log.pdf' 
    });
  });
});
