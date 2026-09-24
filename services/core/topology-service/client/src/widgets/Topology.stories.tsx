// File: src/widgets/Topology.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { Asset, Organization } from '@contracts/domain';
import { 
  ConnectionFormWidget, 
  NetworkCanvasWidget, 
  AssetSelector, 
  OrganizationSelector 
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

// ------------------------------------------------------------------
// 4. Isolated Organization Selector Widget
// ------------------------------------------------------------------
export const OrganizationSelectorStory: Story = {
  render: () => {
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    return (
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <OrganizationSelector
          label="Select Transferring Organization"
          selectedId={selectedOrg?.id}
          onChange={setSelectedOrg}
        />
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">Selected ID:</span> {selectedOrg ? selectedOrg.id : 'None'}
        </div>
      </div>
    );
  },
  beforeEach: ({ msw }) => {
    msw.use(handlers[2]);
  },
};

// ------------------------------------------------------------------
// 5. Isolated Asset Selector Widget
// ------------------------------------------------------------------
export const AssetSelectorStory: Story = {
  render: () => {
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    return (
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <AssetSelector
          label="Select Asset to Transfer"
          selectedId={selectedAsset?.id}
          onChange={setSelectedAsset}
        />
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">Selected ID:</span> {selectedAsset ? selectedAsset.id : 'None'}
        </div>
      </div>
    );
  },
  beforeEach: ({ msw }) => {
    msw.use(handlers[3]);
  },
};

// ------------------------------------------------------------------
// 6. Interactive Bidirectional Custody Transfer Flow Story
// ------------------------------------------------------------------
export const CustodyTransferFlowStory: Story = {
  render: () => {
    const [sourceOrg, setSourceOrg] = useState<Organization | null>(null);
    const [targetOrg, setTargetOrg] = useState<Organization | null>(null);
    const [asset, setAsset] = useState<Asset | null>(null);

    const handleAssetChange = (selected: Asset | null) => {
      setAsset(selected);
      if (selected?.currentOwnerId) {
        const found = MOCK_ORGANIZATIONS.find((o) => o.id === selected.currentOwnerId);
        if (found) setSourceOrg(found);
      }
    };

    return (
      <div className="w-full max-w-3xl bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-4">
        <h3 className="text-base font-bold text-gray-800 border-b pb-2">Custody Transfer Orchestration</h3>
        
        {/* 3-Column Layout matching CustodyTransferPage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <OrganizationSelector
            label="1. From (Source)"
            selectedId={sourceOrg?.id}
            excludeId={targetOrg?.id}
            onChange={(org) => {
              setSourceOrg(org);
              if (asset && org && asset.currentOwnerId !== org.id) setAsset(null);
            }}
          />

          <AssetSelector
            label="2. Asset to Transfer"
            selectedId={asset?.id}
            ownerId={sourceOrg?.id}
            excludeOwnerId={targetOrg?.id} // Excludes assets owned by the target org
            onChange={handleAssetChange}
          />

          <OrganizationSelector
            label="3. To (Destination)"
            selectedId={targetOrg?.id}
            excludeId={sourceOrg?.id}
            onChange={(org) => {
              setTargetOrg(org);
              if (asset && org && asset.currentOwnerId === org.id) setAsset(null);
            }}
          />
        </div>

        <div className="p-3 bg-gray-50 rounded-md text-xs font-mono text-gray-600 space-y-1">
          <div><strong className="text-gray-900">Source Org:</strong> {sourceOrg ? `${sourceOrg.name} (${sourceOrg.id})` : 'None'}</div>
          <div><strong className="text-gray-900">Target Org:</strong> {targetOrg ? `${targetOrg.name} (${targetOrg.id})` : 'None'}</div>
          <div><strong className="text-gray-900">Selected Asset:</strong> {asset ? `${asset.nomenclature} [Owner: ${asset.currentOwnerId}]` : 'None'}</div>
        </div>
      </div>
    );
  },
  beforeEach: ({ msw }) => {
    msw.use(handlers[2], handlers[3]);
  },
};