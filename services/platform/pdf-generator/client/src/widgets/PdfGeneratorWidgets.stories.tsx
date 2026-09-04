// File: services/platform/pdf-generator/client/src/widgets/PdfGeneratorWidgets.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import GeneratePdfButton from './GeneratePdfButton';

const meta: Meta<typeof GeneratePdfButton> = {
  title: 'Widgets/GeneratePdfButton',
  component: GeneratePdfButton,
  args: {
    htmlPayload: '<h1>Hello from Storybook!</h1>',
  },
  argTypes: {
    onSuccess: { action: 'onSuccess (Blob URL Generated)' },
    onError: { action: 'onError (Generation Failed)' },
  },
};

export default meta;
type Story = StoryObj<typeof GeneratePdfButton>;

export const Default: Story = {};

export const CustomTextAndFile: Story = {
  args: {
    buttonText: 'Download Invoice',
    fileName: 'invoice-1024.pdf',
  },
};

export const DisabledEmptyPayload: Story = {
  args: {
    htmlPayload: '',
    buttonText: 'Requires HTML Payload',
  },
};