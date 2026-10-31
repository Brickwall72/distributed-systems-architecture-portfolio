// File: packages/ui/src/components/DocumentViewer/DocumentViewer.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import DocumentViewer from './DocumentViewer';

const meta: Meta<typeof DocumentViewer> = {
  title: 'Shared Components/DocumentViewer',
  component: DocumentViewer,
  tags: ['autodocs'],
  argTypes: {
    content: { control: 'text' },
    contentType: { control: 'select', options: ['html', 'pdf', undefined] },
    title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof DocumentViewer>;

// ==========================================
// Document Viewer Stories
// ==========================================

export const NoContentView: Story = {
  render: (args) => <DocumentViewer {...args} />,
  args: {
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '800px', height: '600px', borderColor: 'black', borderWidth: 5, borderRadius: 10 }}>
        <Story />
      </div>
    ),
  ],
};

export const HtmlPreview: Story = {
  render: (args) => <DocumentViewer {...args} />,
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
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '800px', height: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

const localTestPdfUrl = new URL('../../__fixtures__/example.pdf', import.meta.url).href;

export const PdfView: Story = {
  render: (args) => <DocumentViewer {...args} />,
  args: {
    content: localTestPdfUrl,
    contentType: 'pdf',
    title: 'Generated PDF View',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '800px', height: '600px' }}>
        <Story />
      </div>
    ),
  ],
};