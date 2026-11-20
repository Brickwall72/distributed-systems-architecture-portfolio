// File: ui-shells/domain-shells/compliance-shell/src/pages/TransferAuthorization/TransferAuthorization.page.refresh.integration.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestSession } from '@shared/testing';
import type { ComplianceWorkflowWidgetProps } from '@contracts/compliance';
import UnifiedCustodyPage from './TransferAuthorization.page';

const apiClient = vi.hoisted(() => ({ getOrganizations: vi.fn(), getAssets: vi.fn() }));

vi.mock('../../../../../../services/core/topology-service/client/src/api', () => ({
  apiClient,
}));
vi.mock('../../../../../../services/core/compliance-service/client/src/hooks', () => ({
  useTemplatesQuery: () => ({
    data: [{ id: 'asset-transfer-authorization', name: 'Authorization' }], isLoading: false, error: null,
  }),
  useTemplateQuery: (id?: string) => ({
    data: id ? {
      id, name: 'Authorization', type: 'AUTHORIZATION', transferType: 'PHYSICAL_TRANSFER', rawHTML: '<p>Authorization</p>',
    } : undefined,
    isLoading: false, error: null,
  }),
}));
vi.mock('@shared/mf-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/mf-runtime')>();
  const { default: AssetSelector } = await vi.importActual<{ default: unknown }>('../../../../../../services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector');
  const { default: OrganizationSelector } = await vi.importActual<{ default: unknown }>('../../../../../../services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector');
  const { default: TemplateSelector } = await vi.importActual<{ default: unknown }>('../../../../../../services/core/compliance-service/client/src/widgets/TemplateSelector/TemplateSelector');
  return {
    ...actual,
    lazyRemote: (id: string) => {
      if (id === 'topology_client/AssetSelector') return AssetSelector;
      if (id === 'topology_client/OrganizationSelector') return OrganizationSelector;
      if (id === 'compliance_client/TemplateSelector') return TemplateSelector;
      return (props: ComplianceWorkflowWidgetProps) => (
        <div>
          <output data-testid="viewer">{props.sourceOrg?.id}:{props.targetOrg?.id}:{props.assets?.map((asset) => asset.id).join(',')}:{props.template?.id}</output>
          <button onClick={() => props.onDocumentSaved?.('document-1')}>Save authorization</button>
          <button onClick={() => props.onTopologyApplied?.('document-1')}>Apply authorization</button>
        </div>
      );
    },
  };
});

it('clears actual authorization controls while retaining the source and signed viewer', async () => {
  setTestSession();
  const source = { id: 'org-test', name: 'Source', type: 'GOV_AGENCY' };
  const target = { id: 'target', name: 'Target', type: 'CONTRACTOR' };
  const asset = {
    id: 'asset-1', name: 'Asset One', nomenclature: 'Asset', serialNumber: '1',
    type: 'TEST', controlType: 'LOCAL', status: 'AVAILABLE', currentOwnerId: 'org-test',
  };
  const secondAsset = { ...asset, id: 'asset-2', name: 'Asset Two', serialNumber: '2' };
  vi.mocked(apiClient.getOrganizations).mockImplementation(async () => ({
    status: 200, body: [source, target], headers: new Headers(),
  }) as never);
  vi.mocked(apiClient.getAssets).mockImplementation(async () => ({
    status: 200, body: [asset, secondAsset], headers: new Headers(),
  }) as never);

  render(<QueryClientProvider client={new QueryClient()}><UnifiedCustodyPage /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('Compliance Form')).toHaveValue('asset-transfer-authorization'));
  await waitFor(() => expect(screen.getByLabelText('Target Organization')).toHaveValue('target'));
  fireEvent.click(await screen.findByRole('button', { name: /Asset for Transfer/i }));
  fireEvent.click(await screen.findByRole('option', { name: /Asset One/ }));
  await waitFor(() => expect(screen.getByTestId('viewer')).toHaveTextContent('org-test:target:asset-1:asset-transfer-authorization'));

  fireEvent.click(screen.getByText('Save authorization'));
  await waitFor(() => expect(screen.getByLabelText('Compliance Form')).toHaveValue(''));
  await waitFor(() => expect(screen.getByLabelText('Target Organization')).toHaveValue(''));
  expect(await screen.findByRole('button', { name: /Asset for Transfer/i })).toHaveTextContent('-- Select Assets --');
  expect(screen.queryByLabelText('Source Organization')).not.toBeInTheDocument();
  expect(screen.getByTestId('viewer')).toHaveTextContent('org-test:target:asset-1:asset-transfer-authorization');

  fireEvent.click(screen.getByRole('button', { name: /Asset for Transfer/i }));
  expect(screen.queryByRole('option', { name: /Asset One/ })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('option', { name: /Asset Two/ }));
  await waitFor(() => expect(screen.getByTestId('viewer')).toHaveTextContent('org-test:target:asset-2'));
  fireEvent.click(screen.getByText('Apply authorization'));
  await waitFor(() => expect(screen.getByRole('button', { name: /Asset for Transfer/i })).toHaveTextContent('Asset Two'));
});
