// File: packages/ui/src/lib/templateEngine.ts
import Handlebars from 'handlebars';

/**
 * Hydrates a raw HTML template string with a structured JSON payload.
 * Isolated in @shared/ui-components to allow any domain shell to programmatically 
 * construct documents without owning the template schema.
 */
export function hydrateTemplate<T extends object>(
  templateHtml: string,
  data: T
): string {
  try {
    // Compile the raw string into a renderable function
    const template = Handlebars.compile(templateHtml, {
      strict: false, // Prevents throwing if a variable is missing (fails gracefully to empty string)
    });
    
    // Execute the function with our specific data payload
    return template(data);
  } catch (error) {
    console.error('Template hydration engine error:', error);
    return `<div style="color: red; font-family: monospace;">
      <h3>Document Rendering Failure</h3>
      <p>The shared template engine failed to parse the document.</p>
    </div>`;
  }
}