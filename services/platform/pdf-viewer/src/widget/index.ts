import pdfjs from 'pdfjs-dist';

export interface PDFViewerWidgetOptions {
  element: HTMLElement;
  documentId: string;
  streamUrl?: string;
}

export class PDFViewerWidget {
  public element: HTMLElement;
  public documentId: string;
  public streamUrl: string;

  constructor(options: PDFViewerWidgetOptions) {
    // Structural Input validation boundary gate
    if (!options.documentId) {
      throw new Error('PDFViewerWidget: Missing required parameter documentId');
    }
    this.element = options.element;
    this.documentId = options.documentId;
    this.streamUrl = options.streamUrl || '/v1/stream';
  }

  /**
   * Generates a fully qualified stream target URL mapping protected against injection
   */
  public getTargetUrl(): string {
    return `${this.streamUrl}?documentId=${encodeURIComponent(this.documentId)}`;
  }

  /**
   * Initializes the core PDF.js compilation task to resolve asset page counts
   */
  public async initializeViewEngine(): Promise<number> {
    const targetUrl = this.getTargetUrl();
    const loadingTask = pdfjs.getDocument({ url: targetUrl });
    const pdf = await loadingTask.promise;
    return pdf.numPages;
  }
}
