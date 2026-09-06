// File: services/core/compliance-service/client/src/ComplianceWidget.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { CustodyTransferForm } from '.';

const meta: Meta<typeof CustodyTransferForm> = {
  title: 'Widgets/CustodyTransferForm',
  component: CustodyTransferForm,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof CustodyTransferForm>;

export const FlightControlCockpitDashboard: Story = {
  args: {
    sourceOrg: {
      id: 'org-1',
      name: 'Alpha Logistics Command',
      addressLine1: '123 Supply Depot Rd',
      addressLine2: 'Building 400',
    },
    targetOrg: {
      id: 'org-2',
      name: 'Bravo Tactical Group',
      addressLine1: '456 Forward Operating Base',
      addressLine2: '',
    },
    asset: {
      id: 'asset-1',
      nomenclature: 'AN/PRC-117F Radio',
      serialNumber: 'SN-99882231',
      currentOwnerId: 'org-1',
    },
    children: (payload, isValid) => (
      <div className="flex flex-col gap-3">
        <button 
          disabled={!isValid}
          className={`w-full py-2.5 px-4 rounded-md font-semibold text-white transition-colors shadow-sm ${
            isValid ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'
          }`}
          onClick={() => alert(`Action triggered with payload:\n${JSON.stringify(payload, null, 2)}`)}
        >
          {isValid ? 'Generate DD-1149 PDF' : 'Complete Form Requirements'}
        </button>
        <div className="text-xs text-gray-500 text-center">
          Contract Validation Status: <span className={isValid ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
            {isValid ? 'Valid & Ready' : 'Incomplete'}
          </span>
        </div>
      </div>
    ),
  },
};