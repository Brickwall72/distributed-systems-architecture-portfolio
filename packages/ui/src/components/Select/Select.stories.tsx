// File: packages/ui/components/Select/Select.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Shared Components/Select',
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
    selectedId: '',
    onSelection: () => {},
  },
};

export const Interactive: Story = {
  args: {
    label: 'Country',
    options: defaultOptions,
    selectedId: 'usa',
    onSelection: () => {},
  },
  render: (args) => {
    const InteractiveSelect = () => {
      const [value, setValue] = useState(
        !args.isMulti && 'selectedId' in args ? (args.selectedId ?? '') : '',
      );

      return (
        <Select
          {...args}
          isMulti={false}
          selectedId={value}
          onSelection={(newValue) => {
            setValue(newValue);
            (args.onSelection as ((value: string) => void) | undefined)?.(newValue);
          }}
        />
      );
    };

    return <InteractiveSelect />;
  },
};

export const MultiSelectInteractive: Story = {
  args: {
    label: 'Countries (Multi-Select)',
    options: defaultOptions,
    isMulti: true,
    selectedIds: ['usa', 'can'],
    onSelection: () => {},
  },
  render: (args) => {
    const MultiSelectStory = () => {
      const [selectedIds, setSelectedIds] = useState<string[]>(
        args.isMulti && 'selectedIds' in args ? (args.selectedIds ?? []) : [],
      );

      return (
        <Select
          {...args}
          isMulti={true}
          selectedIds={selectedIds}
          onSelection={(newValue) => {
            setSelectedIds(newValue);
            (args.onSelection as ((value: string[]) => void) | undefined)?.(newValue);
          }}
        />
      );
    };

    return <MultiSelectStory />;
  },
};

export const Loading: Story = {
  args: {
    label: 'Country',
    options: [],
    isLoading: true,
    loadingText: 'Loading countries...',
    selectedId: '',
    onSelection: () => {},
  },
};

export const ErrorState: Story = {
  args: {
    label: 'Country',
    options: [],
    error: 'Network timeout while fetching countries.',
    selectedId: '',
    onSelection: () => {},
  },
};