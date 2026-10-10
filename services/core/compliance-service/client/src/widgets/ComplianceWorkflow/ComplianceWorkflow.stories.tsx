// File: services/core/compliance-service/client/src/widgets/ComplianceWorkflow.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import ComplianceWorkflowWidget from './ComplianceWorkflow';
import { complianceApiHandlers } from '../../utils/mswHandlers';

const meta: Meta<typeof ComplianceWorkflowWidget> = {
  title: 'Widgets/Compliance Client/ComplianceWorkflowWidget',
  component: ComplianceWorkflowWidget,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: complianceApiHandlers,
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full h-screen p-6 bg-slate-950 text-slate-100 overflow-auto">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ComplianceWorkflowWidget>;

/**
 * Default mounted state with populated source organization, target organization,
 * and transferred asset payloads passed from the Host Shell.
 */
export const Default: Story = {
  args: {
    sourceOrg: {
      id: 'TR-2026-8801',
      name: 'AeroDefense Systems Corp',
      type: 'GOV',
    },
    targetOrg: {
      id: 'TX-2024-8532',
      name: 'AeroDyne Systems',
      type: 'CONTRACTOR',
    },
    assets: [
      {
        id: '12345',
        name: 'Rocket',
        nomenclature: 'Rocket System Alpha',
        serialNumber: '123455',
      },
    ],
  },
};

/**
 * Unhydrated initial state rendered when mounted by the Host Shell
 * prior to user selection of organizations and assets.
 */
export const Unhydrated: Story = {
  args: {
    sourceOrg: undefined,
    targetOrg: undefined,
    assets: [],
  },
};