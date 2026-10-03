// File: services/core/compliance-service/client/src/api/templates/templates.unit.test.ts
import { fetchTemplateManifest, fetchTemplateContent } from './templates';
import { setApiBaseUrl } from '../client-config';

describe('Templates API Unit Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    setApiBaseUrl('http://localhost:3000');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setApiBaseUrl('');
  });

  it('escapes template IDs with special characters to prevent path traversal', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '<html></html>',
    } as Response);

    await fetchTemplateContent('dd-1149/../malicious');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/compliance/api/v1/templates/dd-1149%2F..%2Fmalicious'
    );
  });

  it('formats status code and text when manifest fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    } as Response);

    await expect(fetchTemplateManifest()).rejects.toThrow(
      'Failed to fetch template manifest: 403 Forbidden'
    );
  });

  it('throws Zod error when response payload fails contract schema parsing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ invalidField: true }],
    } as Response);

    await expect(fetchTemplateManifest()).rejects.toThrow();
  });
});