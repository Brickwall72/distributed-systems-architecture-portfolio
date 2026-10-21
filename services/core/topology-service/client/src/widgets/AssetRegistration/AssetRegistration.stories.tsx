// File: services/core/topology-service/client/src/widgets/AssetRegistration/AssetRegistration.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import AssetRegistrationWidget from './AssetRegistration';
import type { OrganizationDTO } from '@contracts/topology';

const meta: Meta<typeof AssetRegistrationWidget> = {
  title: 'Widgets/Topology/AssetRegistration',
  component: AssetRegistrationWidget,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-slate-100 min-h-screen flex justify-center items-center">
        <div className="w-full max-w-md">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const MOCK_ORGANIZATIONS: OrganizationDTO[] = [
  { id: 'org-1', name: 'Alpha Command', type: 'CONTRACTOR', addressLine1: 'Pad 39-B' },
  { id: 'org-2', name: 'Bravo Logistics', type: 'GOV_AGENCY', addressLine1: 'Building 2730' },
];

// ------------------------------------------------------------------
// 1. Default (Ready) State Story
// ------------------------------------------------------------------
export const Default: Story = {
  render: () => <AssetRegistrationWidget />,
  parameters: {
    msw: {
      handlers: [
        http.get('/topology/api/v1/organizations', () => {
          return HttpResponse.json(MOCK_ORGANIZATIONS);
        }),
        http.post('/topology/api/v1/assets', async ({ request }) => {
          const body = (await request.json()) as any;
          return HttpResponse.json(
            {
              id: body.id,
              name: body.name,
              nomenclature: body.nomenclature,
              serialNumber: body.serialNumber,
              status: body.status,
              currentOwnerId: body.currentOwnerId,
            },
            { status: 201 }
          );
        }),
      ],
    },
  },
};

// ------------------------------------------------------------------
// 2. Server Error Mutation State Story
// ------------------------------------------------------------------
export const MutationError: Story = {
  render: () => <AssetRegistrationWidget />,
  parameters: {
    msw: {
      handlers: [
        http.get('/topology/api/v1/organizations', () => {
          return HttpResponse.json(MOCK_ORGANIZATIONS);
        }),
        http.post('/topology/api/v1/assets', () => {
          return HttpResponse.json(
            { error: 'Asset ID already exists in Neo4j graph registry', code: 'DUPLICATE_NODE' },
            { status: 500 }
          );
        }),
      ],
    },
  },
};