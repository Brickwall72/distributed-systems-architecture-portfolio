// File: packages/ui/components/Select/Select.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Shared Components/@shared ui-components/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    isLoading: { control: 'boolean' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const defaultOptions = [
  { id: 'usa', name: 'United States' },
  { id: 'can', name: 'Canada' },
  { id: 'mex', name: 'Mexico' },
];

export const Default: Story = {
  args: {
    label: 'Country',
    options: defaultOptions,
  },
};

export const Interactive: Story = {
  args: {
    label: 'Country',
    options: defaultOptions,
    selectedId: 'usa',
  },
  render: (args) => {
    const InteractiveSelect = () => {
      const [value, setValue] = useState(args.selectedId ?? '');

      return (
        <Select
          {...args}
          selectedId={value}
          onSelection={(newValue) => {
            setValue(newValue);
            // Optionally chain to storybook actions if configured
            args.onSelection?.(newValue);
          }}
        />
      );
    };

    return <InteractiveSelect />;
  },
};

export const Loading: Story = {
  args: {
    label: 'Country',
    options: [],
    isLoading: true,
    loadingText: 'Loading countries...',
  },
};

export const ErrorState: Story = {
  args: {
    label: 'Country',
    options: [],
    error: 'Network timeout while fetching countries.',
  },
};