// File: services/core/topology-service/client/src/widgets/NetworkCanvas/NetworkCanvas.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import type { GraphDTO } from 'topology-shared';
import NetworkCanvas from './NetworkCanvas';

const meta: Meta<typeof NetworkCanvas> = {
  title: 'Widgets/Topology/NetworkCanvas',
  component: NetworkCanvas,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-slate-100 min-h-screen flex justify-center items-center">
        <div className="w-full max-w-4xl">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock Graph Dataset matching updated GraphDTO structure with multi-asset transfer array
const MOCK_GRAPH_DATA: GraphDTO = {
  timestamp: new Date().toISOString(),
  organizations: [
    { id: 'org-1', name: 'Alpha Command', type: 'CONTRACTOR', addressLine1: '123 Base Rd', addressLine2: 'Suite 100' },
    { id: 'org-2', name: 'Bravo Logistics', type: 'GOV_AGENCY', addressLine1: '456 Depot Way' },
  ],
  assets: [
    { id: 'asset-1', name: 'Tactical Radio', nomenclature: 'Tactical Radio', serialNumber: 'TR-102938', status: 'AVAILABLE', currentOwnerId: 'org-1' },
    { id: 'asset-2', name: 'Night Vision Goggles', nomenclature: 'Night Vision Goggles', serialNumber: 'NVG-554433', status: 'IN_TRANSIT', currentOwnerId: 'org-2' },
    { id: 'asset-3', name: 'Secure Satellite Terminal', nomenclature: 'Secure Satellite Terminal', serialNumber: 'SST-778899', status: 'IN_TRANSIT', currentOwnerId: 'org-2' },
  ],
  activeTransfers: [
    {
      requisitionNumber: 'REQ-TR-001',
      date: '20261020',
      type: 'PHYSICAL_TRANSFER',
      status: 'IN_TRANSIT',
      senderOrgId: 'org-1',
      senderName: 'Alpha Command',
      receiverOrgId: 'org-2',
      receiverName: 'Bravo Logistics',
      assets: [
        {
          assetId: 'asset-2',
          assetNomenclature: 'Night Vision Goggles',
          serialNumber: 'NVG-554433',
          invStatus: 'IN_TRANSIT',
        },
        {
          assetId: 'asset-3',
          assetNomenclature: 'Secure Satellite Terminal',
          serialNumber: 'SST-778899',
          invStatus: 'IN_TRANSIT',
        },
      ],
    },
  ],
  custodyLinks: [
    { orgId: 'org-1', assetId: 'asset-1' },
  ],
};

// ------------------------------------------------------------------
// 1. Success State Story
// ------------------------------------------------------------------
export const Success: Story = {
  render: () => <NetworkCanvas />,
  parameters: {
    msw: {
      handlers: [
        http.get('/topology/api/v1/graph', () => {
          return HttpResponse.json(MOCK_GRAPH_DATA);
        }),
      ],
    },
  },
};

// ------------------------------------------------------------------
// 2. Error State Story
// ------------------------------------------------------------------
export const Failure: Story = {
  render: () => <NetworkCanvas />,
  parameters: {
    msw: {
      handlers: [
        http.get('/topology/api/v1/graph', () => {
          return new HttpResponse(null, { status: 500, statusText: 'Database Connection Lost' });
        }),
      ],
    },
  },
};