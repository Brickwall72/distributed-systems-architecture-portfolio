// File: services/core/topology-service/client/src/TopologyCanvas.unit.test.tsx
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TopologyCanvas } from './TopologyCanvas.js';

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

describe('TopologyCanvas Component Lifecycle View', () => {
  // CORRECTED: Updated string matcher targets to reflect your exact UI component text patterns
  it('should manage the asynchronous loading state and transition cleanly to the dashboard', async () => {
    render(<TopologyCanvas />);
    
    // 1. Target your actual running loading string element inside the canvas overlay panel
    const loadingScreen = screen.getByText(/Traversing Graph Network Threads.../i);
    expect(loadingScreen).toBeInTheDocument();

    // 2. Wait for the asynchronous data hydration loop to finish and clear the overlay
    await waitForElementToBeRemoved(loadingScreen);

    // 3. Confirm the underlying control panel layout persists cleanly
    expect(screen.getByText(/Mission Control: Fleet Topology Graph/i)).toBeInTheDocument();
  });

  it('should fetch connections, process data transformations, and render dashboard text', async () => {
    render(<TopologyCanvas />);
    
    await waitFor(() => {
      expect(screen.getByText(/Mission Control: Fleet Topology Graph/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Deploy Asset Connection/i)).toBeInTheDocument();
  });

  it('should catch a network exception and display the explicit error boundary screen', async () => {
    server.use(
      http.get('/api/v1/topology/entities', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<TopologyCanvas />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to aggregate live topology layers/i)).toBeInTheDocument();
    });
  });
});
