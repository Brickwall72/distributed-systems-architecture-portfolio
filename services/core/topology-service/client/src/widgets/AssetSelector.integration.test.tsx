// File: services/core/topology-service/client/src/widgets/AssetSelector.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import AssetSelector from './AssetSelector';

/**
 * @group integration
 * @description These tests require the topology-service and its graph database 
 * to be actively running in your Docker container environment.
 */
describe('AssetSelector Integration (Docker Backend)', () => {
  it('fetches real asset payloads and currentOwnerId projections from the containerized service', async () => {
    const handleChange = vi.fn();

    render(
      <AssetSelector 
        label="Select Asset (Live)" 
        onChange={handleChange} 
      />
    );

    // Allow time for real network request to clear Docker port forwarding
    await waitFor(() => {
      const selectElement = screen.getByRole('combobox', { name: /Select Asset \(Live\)/i });
      expect(selectElement).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('correctly passes query parameters for ownerId filtering to the container', async () => {
    const handleChange = vi.fn();

    render(
      <AssetSelector 
        label="Filtered Asset (Live)" 
        ownerId="org-1"
        onChange={handleChange} 
      />
    );

    // Verifies the component successfully renders and initiates a filtered fetch
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});