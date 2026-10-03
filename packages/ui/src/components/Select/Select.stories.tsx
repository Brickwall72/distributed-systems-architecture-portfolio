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
  { value: 'usa', label: 'United States' },
  { value: 'can', label: 'Canada' },
  { value: 'mex', label: 'Mexico' },
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
    value: 'usa',
  },
  render: (args) => {
    const InteractiveSelect = () => {
      const [value, setValue] = useState(args.value ?? '');

      return (
        <Select
          {...args}
          value={value}
          onValueChange={(newValue) => {
            setValue(newValue);
            // Optionally chain to storybook actions if configured
            args.onValueChange?.(newValue);
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