// File: services/core/topology-service/client/src/widgets/CustodyTransferSelector/CustodyTransferSelector.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import CustodyTransferSelector from './CustodyTransferSelector';

const mockOrganizations = [
  { id: 'org-101', name: '1st Battalion, 5th Marines', code: '1/5', address1: 'Camp Pendleton, CA' },
  { id: 'org-102', name: '2nd Battalion, 5th Marines', code: '2/5', address1: 'Camp Pendleton, CA' },
  { id: 'org-103', name: '3rd Battalion, 5th Marines', code: '3/5', address1: '29 Palms, CA' },
];

const mockAssets = [
  { id: 'ast-001', nomenclature: 'AN/PRC-117G Radio', serialNumber: 'SN-772819', ownerId: 'org-101' },
  { id: 'ast-002', nomenclature: 'M240B Machine Gun', serialNumber: 'SN-994820', ownerId: 'org-101' },
  { id: 'ast-003', nomenclature: 'JLTV Utility Vehicle', serialNumber: 'SN-110293', ownerId: 'org-102' },
];

const meta: Meta<typeof CustodyTransferSelector> = {
  title: 'Widgets/Topology Client/CustodyTransferSelector',
  component: CustodyTransferSelector,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get('/topology/api/v1/organizations', ({ request }) => {
          const url = new URL(request.url);
          const excludeId = url.searchParams.get('excludeId');

          let filtered = mockOrganizations;
          if (excludeId) {
            filtered = filtered.filter((org) => org.id !== excludeId);
          }

          return HttpResponse.json(filtered);
        }),

        http.get('/topology/api/v1/assets', ({ request }) => {
          const url = new URL(request.url);
          const ownerId = url.searchParams.get('ownerId');

          let filtered = mockAssets;
          if (ownerId) {
            filtered = filtered.filter((asset) => asset.ownerId === ownerId);
          }

          return HttpResponse.json(filtered);
        }),
      ],
    },
  },
  argTypes: {
    onStateChange: { action: 'onStateChange' },
  },
};

export default meta;
type Story = StoryObj<typeof CustodyTransferSelector>;

export const Default: Story = {
  args: {
    onStateChange: (state) => console.log('CustodyTransferSelector State Updated:', state),
  },
};

export const SimulatedNetworkDelay: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/topology/api/v1/organizations', async () => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return HttpResponse.json(mockOrganizations);
        }),
        http.get('/topology/api/v1/assets', async () => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return HttpResponse.json(mockAssets);
        }),
      ],
    },
  },
};