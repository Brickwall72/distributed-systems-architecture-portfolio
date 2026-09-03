// File: services/core/topology-service/client/src/widgets/NetworkCanvasWidget.unit.test.tsx
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import NetworkCanvasWidget from './NetworkCanvasWidget';

const server = setupServer(
  http.get('/api/v1/topology/entities', () => {
    return HttpResponse.json({
      connections: [
        {
          sourceAssetId: 'ac-f16-alpha',
          sourceLabel: 'F-16 Flight Alpha',
          targetAssetId: 'fob-bastion',
          targetLabel: 'FOB Bastion Outpost',
          actionContext: 'SQUADRON_HANDOVER'
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

    const loadingScreen = screen.getByText(/Traversing Graph Network Threads.../i);
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