// File: services/core/compliance-service/src/frontend/ComplianceWidget.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ComplianceWidget } from './ComplianceWidget.js';

const meta: Meta<typeof ComplianceWidget> = {
  title: 'Compliance/ComplianceWidget',
  component: ComplianceWidget,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ComplianceWidget>;

export const FlightControlCockpitDashboard: Story = {};
