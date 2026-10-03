// File: src/widgets/Topology.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import { Asset, Organization } from '@contracts/custody';
import { 
  ConnectionFormWidget, 
  NetworkCanvasWidget 
} from './index.js';

const meta: Meta = {
  title: 'Widgets/Autonomous Topology',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-slate-100 min-h-screen flex justify-center items-center">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Mock Dataset
const MOCK_ORGANIZATIONS: Organization[] = [
  { id: 'org-1', name: 'Alpha Command', type: 'COMMAND', addressLine1: '123 Base Rd', addressLine2: 'Suite 100' },
  { id: 'org-2', name: 'Bravo Logistics', type: 'LOGISTICS', addressLine1: '456 Depot Way', addressLine2: '' },
];

const MOCK_ASSETS: Asset[] = [
  { id: 'asset-1', nomenclature: 'Tactical Radio', serialNumber: 'TR-102938', currentOwnerId: 'org-1' },
  { id: 'asset-2', nomenclature: 'Night Vision Goggles', serialNumber: 'NVG-554433', currentOwnerId: 'org-2' },
  { id: 'asset-3', nomenclature: 'Quantum Sensor', serialNumber: 'QS-998877', currentOwnerId: 'org-1' },
];

// Reusable MSW Handlers
const handlers = [
  http.get('/topology/api/v1/entities', () => {
    return HttpResponse.json({
      connections: [
        {
          sourceAssetId: 'ac-f16-alpha',
          sourceLabel: 'F-16 Flight Alpha',
          targetAssetId: 'fob-bastion',
          targetLabel: 'FOB Bastion Outpost',
          actionContext: 'SQUADRON_HANDOVER',
        },
      ],
    });
  }),
  http.post('/topology/api/v1/entities', async ({ request }) => {
    const body = await request.json();
    console.log('MSW intercepted POST payload:', body);
    return HttpResponse.json({ success: true, timestamp: Date.now() }, { status: 201 });
  }),
  http.get('/topology/api/v1/organizations', () => {
    return HttpResponse.json(MOCK_ORGANIZATIONS);
  }),
  http.get('/topology/api/v1/assets', ({ request }) => {
    const url = new URL(request.url);
    const ownerId = url.searchParams.get('ownerId');
    const excludeOwnerId = url.searchParams.get('excludeOwnerId');

    let filtered = MOCK_ASSETS;
    if (ownerId) {
      filtered = filtered.filter((a) => a.currentOwnerId === ownerId);
    }
    if (excludeOwnerId) {
      filtered = filtered.filter((a) => a.currentOwnerId !== excludeOwnerId);
    }
    return HttpResponse.json(filtered);
  }),
];

// ------------------------------------------------------------------
// 1. Isolated Form Widget
// ------------------------------------------------------------------
export const ConnectionForm: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <ConnectionFormWidget />
    </div>
  ),
  beforeEach: ({ msw }) => {
    msw.use(handlers[1]);
  },
};

// ------------------------------------------------------------------
// 2. Isolated Canvas Widget (Success State)
// ------------------------------------------------------------------
export const NetworkCanvasSuccess: Story = {
  render: () => <NetworkCanvasWidget />,
  beforeEach: ({ msw }) => {
    msw.use(handlers[0]);
  },
};

// ------------------------------------------------------------------
// 3. Isolated Canvas Widget (Error State)
// ------------------------------------------------------------------
export const NetworkCanvasFailure: Story = {
  render: () => <NetworkCanvasWidget />,
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/topology/api/v1/entities', () => {
        return new HttpResponse(null, { status: 500, statusText: 'Database Connection Lost' });
      })
    );
  },
};