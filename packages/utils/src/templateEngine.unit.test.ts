// File: packages/utils/src/templateEngine.unit.test.ts
import { describe, expect, it, vi } from 'vitest';
import { hydrateTemplate } from './templateEngine';

describe('hydrateTemplate', () => {
  it('hydrates a Handlebars template with the provided data', () => {
    expect(hydrateTemplate('<p>{{name}}</p>', { name: 'Ada' })).toBe('<p>Ada</p>');
  });

  it('returns the standard fallback when compilation fails', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(hydrateTemplate('{{#if}', {})).toContain('Document Rendering Failure');
    expect(errorSpy).toHaveBeenCalledWith(
      'Template hydration engine error:',
      expect.anything(),
    );

    errorSpy.mockRestore();
  });
});
