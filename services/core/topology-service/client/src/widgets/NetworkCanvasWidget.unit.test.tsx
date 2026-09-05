// File: services/core/topology-service/client/src/widgets/NetworkCanvasWidget.unit.test.tsx
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import NetworkCanvasWidget from './NetworkCanvasWidget';

const server = setupServer(
  http.get('/api/v1/topology/entities', () => {
    return HttpResponse.json({
      timestamp: new Date().toISOString(),
      transfers: [
        {
          requisitionNumber: 'REQ-2026-SSC-0092',
          transferDate: '20260904',
          senderOrgId: 'org-1111-lockheed',
          senderName: 'Lockheed Martin Space',
          receiverOrgId: 'org-2222-ussf',
          receiverName: 'Space Systems Command (USSF)',
          assetId: 'asset-3333-gps3',
          assetNomenclature: 'GPS III Space Vehicle 11',
          serialNumber: 'GPS-III-SV11-001'
        }
      ]
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NetworkCanvasWidget Component Lifecycle', () => {
  it('should manage the asynchronous loading state and hydrate the canvas container', async () => {
    render(<NetworkCanvasWidget />);

    const loadingScreen = screen.getByText(/Traversing Space Custody Network Threads.../i);
    expect(loadingScreen).toBeInTheDocument();

    await waitForElementToBeRemoved(loadingScreen);
  });

  it('should catch a network exception and display the explicit error boundary screen', async () => {
    server.use(
      http.get('/api/v1/topology/entities', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<NetworkCanvasWidget />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to aggregate live topology layers/i)).toBeInTheDocument();
    });
  });
});