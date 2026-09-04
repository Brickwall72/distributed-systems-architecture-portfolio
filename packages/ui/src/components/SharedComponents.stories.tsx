// File: packages/ui/src/components/SharedComponents.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import DocumentViewer from './DocumentViewer';

const meta: Meta<typeof DocumentViewer> = {
  title: 'Shared Components/Document Viewer',
  component: DocumentViewer,
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '800px', height: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DocumentViewer>;

export const HtmlPreview: Story = {
  args: {
    content: `
      <div style="font-family: sans-serif; padding: 2rem; color: #333;">
        <h1 style="border-bottom: 2px solid #eaeaea; padding-bottom: 0.5rem;">Sample Template</h1>
        <p>This is what the raw HTML looks like before generating the PDF.</p>
      </div>
    `,
    contentType: 'html',
    title: 'HTML Template Preview',
  },
};
const localTestPdfUrl = new URL('../__fixtures__/example.pdf', import.meta.url).href;

export const PdfView: Story = {
  args: {
    // Using a public dummy PDF for the story viewer
    content: localTestPdfUrl,
    contentType: 'pdf',
    title: 'Generated PDF View',
  },
};