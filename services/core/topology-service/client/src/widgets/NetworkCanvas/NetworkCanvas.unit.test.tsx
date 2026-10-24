// File: services/core/topology-service/client/src/widgets/NetworkCanvas/NetworkCanvas.unit.test.tsx
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import NetworkCanvas from './NetworkCanvas';
import type { GraphDTO } from 'topology-shared';

// Mock vis-network correctly as a constructor function
vi.mock('vis-network', () => {
  return {
    Network: function () {
      return {
        destroy: vi.fn(),
        fit: vi.fn(),
      };
    },
  };
});

const mockGraphData: GraphDTO = {
  timestamp: new Date().toISOString(),
  organizations: [
    { id: 'org-1111-lockheed', name: 'Lockheed Martin Space', type: 'CONTRACTOR', addressLine1: 'Pad 39-B' },
    { id: 'org-2222-ussf', name: 'Space Systems Command (USSF)', type: 'GOV_AGENCY', addressLine1: 'Launch Site Alpha' },
  ],
  assets: [
    {
      id: 'asset-3333-gps3',
      name: 'GPS III Space Vehicle 11',
      nomenclature: 'GPS III Space Vehicle 11',
      serialNumber: 'GPS-III-SV11-001',
      status: 'IN_TRANSIT',
      currentOwnerId: 'org-1111-lockheed',
    },
  ],
  activeTransfers: [
    {
      requisitionNumber: 'REQ-2026-SSC-0092',
      date: '20260904',
      type: 'PHYSICAL_TRANSFER',
      status: 'IN_TRANSIT',
      senderOrgId: 'org-1111-lockheed',
      senderName: 'Lockheed Martin Space',
      receiverOrgId: 'org-2222-ussf',
      receiverName: 'Space Systems Command (USSF)',
      assets: [
        {
          id: 'asset-3333-gps3',
          nomenclature: 'GPS III Space Vehicle 11',
          serialNumber: 'GPS-III-SV11-001',
          status: 'IN_TRANSIT',
        },
      ],
    },
  ],
  custodyLinks: [],
};

const server = setupServer(
  http.get('/topology/api/v1/graph', () => {
    return HttpResponse.json(mockGraphData);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NetworkCanvasWidget Component Lifecycle', () => {
  it('should manage the asynchronous loading state and hydrate the canvas container', async () => {
    render(<NetworkCanvas />);

    const loadingScreen = screen.getByText(/Traversing Space Custody Network Threads.../i);
    expect(loadingScreen).toBeInTheDocument();

    await waitForElementToBeRemoved(loadingScreen);
  });

  it('should catch a network exception and display the explicit error boundary screen', async () => {
    server.use(
      http.get('/topology/api/v1/graph', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<NetworkCanvas />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch topology network graph/i)).toBeInTheDocument();
    });
  });
});