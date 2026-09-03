// File: src/widgets/Topology.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import { ConnectionFormWidget, NetworkCanvasWidget} from './index';

const meta: Meta = {
  title: 'Widgets/Autonomous Topology',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-slate-100 min-h-screen">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Common MSW handlers for a successful topology state
const successHandlers = [
  http.get('/api/v1/topology/entities', () => {
    return HttpResponse.json({
      connections: [
        {
          sourceAssetId: 'ac-f16-alpha',
          sourceLabel: 'F-16 Flight Alpha',
          targetAssetId: 'fob-bastion',
          targetLabel: 'FOB Bastion Outpost',
          actionContext: 'SQUADRON_HANDOVER',
        },
        {
          sourceAssetId: 'radar-site-1',
          sourceLabel: 'Early Warning Radar',
          targetAssetId: 'fob-bastion',
          targetLabel: 'FOB Bastion Outpost',
          actionContext: 'DATA_LINK',
        },
      ],
    });
  }),
  http.post('/api/v1/topology/entities', async ({ request }) => {
    const body = await request.json();
    console.log('MSW intercepted POST payload:', body);
    return HttpResponse.json({ success: true, timestamp: Date.now() }, { status: 201 });
  }),
];

// ------------------------------------------------------------------
// 1. Isolated Form Widget
// ------------------------------------------------------------------
export const ConnectionForm: Story = {
  render: () => (
    <div className="max-w-md">
      <ConnectionFormWidget />
    </div>
  ),
  beforeEach: ({ msw }) => {
    msw.use(
      http.post('/api/v1/topology/entities', async ({ request }) => {
        const body = await request.json();
        console.log('Form submission intercepted:', body);
        return HttpResponse.json({ success: true }, { status: 201 });
      })
    );
  },
};

// ------------------------------------------------------------------
// 2. Isolated Canvas Widget (Success State)
// ------------------------------------------------------------------
export const NetworkCanvasSuccess: Story = {
  render: () => <NetworkCanvasWidget />,
  beforeEach: ({ msw }) => {
    msw.use(successHandlers[0]); // Only need the GET handler here
  },
};

// ------------------------------------------------------------------
// 3. Isolated Canvas Widget (Error / Failure State)
// ------------------------------------------------------------------
export const NetworkCanvasFailure: Story = {
  render: () => <NetworkCanvasWidget />,
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/v1/topology/entities', () => {
        return new HttpResponse(null, { status: 500, statusText: 'Database Connection Lost' });
      })
    );
  },
};