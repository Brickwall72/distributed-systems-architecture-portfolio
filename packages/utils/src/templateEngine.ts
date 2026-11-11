// File: packages/utils/src/templateEngine.ts
import Handlebars from 'handlebars';

export function hydrateTemplate<T extends object>(
  templateHtml: string,
  data: T,
): string {
  try {
    const template = Handlebars.compile(templateHtml, {
      strict: false,
    });

    return template(data);
  } catch (error) {
    console.error('Template hydration engine error:', error);
    return `<div style="color: red; font-family: monospace;">
      <h3>Document Rendering Failure</h3>
      <p>The shared template engine failed to parse the document.</p>
    </div>`;
  }
}
