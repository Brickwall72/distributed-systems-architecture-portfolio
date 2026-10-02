// File: services/platform/pdf-generator/client/src/api/generatePdf.unit.test.ts
import { generatePdf } from './generatePdf';

describe('generatePdf Unit Tests', () => {
  const mockCreateObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL.mockReturnValue('blob:http://localhost/mock-uuid'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts HTML payload and returns object URL on 200 OK', async () => {
    const mockBlob = new Blob(['%PDF-1.4 binary mock data'], { type: 'application/pdf' });
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const html = '<p>Test Document</p>';
    const result = await generatePdf(html);

    expect(fetch).toHaveBeenCalledWith('/pdf/api/v1/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    });
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(result).toBe('blob:http://localhost/mock-uuid');
  });

  it('throws an error containing status text when HTTP response is not ok', async () => {
    const mockResponse = {
      ok: false,
      statusText: 'Internal Server Error',
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await expect(generatePdf('<h1>Error Case</h1>')).rejects.toThrow(
      'Failed to generate PDF: Internal Server Error'
    );
  });
});