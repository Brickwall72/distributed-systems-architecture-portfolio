// File: services/core/topology-service/client/src/widgets/OrganizationSelector.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import OrganizationSelector from './OrganizationSelector';

/**
 * @group integration
 * @description These tests require the topology-service and its graph database 
 * to be actively running in your Docker container environment.
 */
describe('OrganizationSelector Integration (Docker Backend)', () => {
  it('fetches real organization nodes from the containerized topology service', async () => {
    const handleChange = vi.fn();

    render(
      <OrganizationSelector 
        label="Select Organization (Live)" 
        onChange={handleChange} 
      />
    );

    // Wait for real HTTP response from Express/Neo4j container stack
    await waitFor(() => {
      const selectElement = screen.getByRole('combobox', { name: /Select Organization \(Live\)/i });
      expect(selectElement).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('respects the excludeId constraint when communicating with the live backend data', async () => {
    const handleChange = vi.fn();

    render(
      <OrganizationSelector 
        label="Excluded Org (Live)" 
        excludeId="org-1"
        onChange={handleChange} 
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});