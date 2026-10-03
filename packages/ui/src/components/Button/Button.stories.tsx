// File: packages/ui/src/components/SharedComponents.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta = {
  title: 'Shared Components/@shared ui-components/Button',
  component: Button,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl p-6 bg-slate-950 rounded-xl border border-slate-800 text-slate-100 shadow-xl min-h-[400px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;

// ==========================================
// Button Stories
// ==========================================

export const ButtonDefault: StoryObj<typeof Button> = {
  render: (args) => <Button {...args} />,
  args: {
    children: 'Execute Transfer',
    variant: 'primary',
    size: 'md',
    isLoading: false,
    disabled: false,
  },
};

export const ButtonVariants: StoryObj<typeof Button> = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const ButtonSizes: StoryObj<typeof Button> = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <Button size="sm">Small (sm)</Button>
      <Button size="md">Medium (md)</Button>
      <Button size="lg">Large (lg)</Button>
    </div>
  ),
};

export const ButtonStates: StoryObj<typeof Button> = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <Button isLoading>Generating PDF...</Button>
      <Button disabled>Action Restricted</Button>
    </div>
  ),
};

export const ButtonWithIcons: StoryObj<typeof Button> = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <Button leftIcon={<span>←</span>}>Previous Step</Button>
      <Button rightIcon={<span>→</span>}>Next Step</Button>
    </div>
  ),
};
