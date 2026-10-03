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
      <div className="w-full h-screen p-6 bg-slate-950 text-slate-100">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ComplianceWorkflowWidget>;

export const Default: Story = {
  args: {
    templateData: {
      organizationName: 'AeroDefense Systems Corp',
      transferId: 'TR-2026-8801',
      securityLevel: 'TS/SCI',
    },
    documentId: 'doc-9942-alpha',
    requisitionNumber: 'REQ-2026-0042',
    signerId: 'usr-devsecops-01',
    entityId: 'ent-aero-depot',
    onWorkflowComplete: (signedPdfUrl) => {
      console.log('Workflow Completed. Signed PDF URL:', signedPdfUrl);
    },
  },
};

export const Unhydrated: Story = {
  args: {
    ...Default.args,
    templateData: null,
  },
};