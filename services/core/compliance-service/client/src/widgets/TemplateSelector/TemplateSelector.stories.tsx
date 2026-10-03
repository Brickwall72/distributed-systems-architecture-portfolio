// File: services/core/compliance-service/client/src/widgets/TemplateSelector/TemplateSelector.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import TemplateSelector from './TemplateSelector';
import { complianceApiHandlers } from '../../utils/mswHandlers';

const meta: Meta<typeof TemplateSelector> = {
  title: 'Widgets/Compliance Client/TemplateSelector',
  component: TemplateSelector,
  parameters: {
    msw: {
      handlers: complianceApiHandlers,
    },
  },
  decorators: [
    (Story) => (
      <div className="w-80 p-4 bg-slate-900 rounded-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TemplateSelector>;

export const Default: Story = {
  args: {
    label: 'Select Compliance Form',
    onTemplateLoad: (id, html) => {
      console.log(`Loaded Template ID [${id}]:`, html);
    },
  },
};