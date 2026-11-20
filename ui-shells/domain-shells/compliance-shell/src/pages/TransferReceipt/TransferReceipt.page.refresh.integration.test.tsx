// File: ui-shells/domain-shells/compoliance-shell/src/pages/TransferReceipt/TransferReceiptPage.refresh.integration.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockFromSchema, setTestSession } from '@shared/testing';
import { DocumentListItemSchema } from '../../../../../../services/core/compliance-service/shared/src/schemas/DTO/document.dto.schema';
import { FORM_ID, type ComplianceWorkflowWidgetProps } from '@contracts/compliance';
import DocumentsTable from '../../../../../../services/core/compliance-service/client/src/widgets/DocumentsTable/DocumentsTable';
import AssetSelector from '../../../../../../services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector';
import OrganizationSelector from '../../../../../../services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector';
import TransferReceiptPage from './TransferReceipt.page';

const state = vi.hoisted(() => ({ phase: 'pending' as 'pending' | 'partial' | 'complete' }));

vi.mock('../../../../../../services/core/compliance-service/client/src/api', () => ({
  apiClient: { getDocuments: vi.fn() },
}));
vi.mock('../../../../../../services/core/topology-service/client/src/api', () => ({
  apiClient: { getOrganizations: vi.fn(), getAssets: vi.fn() },
}));
vi.mock('@shared/mf-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/mf-runtime')>();
  return {
    ...actual,
    lazyRemote: (id: string) => {
      if (id === 'compliance_client/DocumentsTable') return DocumentsTable;
      if (id === 'topology_client/AssetSelector') return AssetSelector;
      if (id === 'topology_client/OrganizationSelector') return OrganizationSelector;
      return (props: ComplianceWorkflowWidgetProps) => (
        <div>
          <output data-testid="viewer">{props.requisitionNumber}:{props.assets?.map((asset) => asset.id).join(',')}</output>
          <button onClick={() => props.onDocumentSaved?.('receipt-1')}>Save receipt</button>
          <button onClick={() => props.onTopologyApplied?.('receipt-1')}>Apply receipt</button>
        </div>
      );
    },
  };
});

import { apiClient as complianceApi } from '../../../../../../services/core/compliance-service/client/src/api';
import { apiClient as topologyApi } from '../../../../../../services/core/topology-service/client/src/api';

it('clears real receipt selections on save and refreshes partial and completed transfers on application', async () => {
  setTestSession();
  state.phase = 'pending';
  const transferId = '12345678-1234-1234-1234-123456789012';
  const document = mockFromSchema(DocumentListItemSchema, {
    requisitionNumber: 'REQ-1', transferEventId: transferId, receiverOrgId: 'org-test',
    name: FORM_ID.ASSET_TRANSFER_AUTHORIZATION, status: 'IN_PROGRESS', topologyApplicationStatus: 'APPLIED',
  });
  const secondTransferId = '22345678-1234-1234-1234-123456789012';
  const secondDocument = { ...document, id: '32345678-1234-1234-1234-123456789012', requisitionNumber: 'REQ-2', transferEventId: secondTransferId };
  const sender = { id: 'sender', name: 'Sender', type: 'CONTRACTOR', requisitions: ['REQ-1'] };
  const secondSender = { id: 'sender-2', name: 'Sender Two', type: 'CONTRACTOR', requisitions: ['REQ-2'] };
  const asset = {
    id: 'asset-1', name: 'Asset One', nomenclature: 'Asset', serialNumber: '1',
    type: 'TEST', controlType: 'LOCAL', status: 'IN_TRANSIT', currentOwnerId: 'sender', requisitionNumber: 'REQ-1',
  };
  const remainingAsset = { ...asset, id: 'asset-2', name: 'Asset Two', serialNumber: '2' };
  const secondTransferAsset = { ...asset, id: 'asset-3', name: 'Asset Three', currentOwnerId: 'sender-2', requisitionNumber: 'REQ-2' };
  vi.mocked(complianceApi.getDocuments).mockImplementation(async (args) => {
    const docs = state.phase === 'complete'
      ? [secondDocument]
      : [{ ...document, status: state.phase === 'partial' ? 'PARTIALLY_COMPLETED' : 'IN_PROGRESS' }, secondDocument];
    const requisitions = args?.query?.requisitionNumbers?.split(',');
    return { status: 200, body: requisitions ? docs.filter((doc) => requisitions.includes(doc.requisitionNumber)) : docs, headers: new Headers() } as never;
  });
  vi.mocked(topologyApi.getOrganizations).mockImplementation(async (args) => {
    const transfer = args?.query?.transferEventId;
    const firstAvailable = state.phase !== 'complete' && (!transfer || transfer === transferId);
    const secondAvailable = !transfer || transfer === secondTransferId;
    const senders = [firstAvailable && sender, secondAvailable && secondSender].filter(Boolean);
    const requisitions = [firstAvailable && 'REQ-1', secondAvailable && 'REQ-2'].filter(Boolean);
    return {
      status: 200,
      body: args?.query?.transferEventRole === 'SENDER'
        ? senders
        : [{ id: 'org-test', name: 'Receiver', type: 'GOV_AGENCY', requisitions }],
      headers: new Headers(),
    } as never;
  });
  vi.mocked(topologyApi.getAssets).mockImplementation(async (args) => {
    const first = state.phase === 'complete' ? [] : state.phase === 'partial' ? [remainingAsset] : [asset, remainingAsset];
    const transfer = args?.query?.transferEventId;
    const assets = [...(transfer && transfer !== transferId ? [] : first), ...(transfer && transfer !== secondTransferId ? [] : [secondTransferAsset])];
    return { status: 200, body: assets, headers: new Headers() } as never;
  });

  render(<QueryClientProvider client={new QueryClient()}><TransferReceiptPage /></QueryClientProvider>);
  await screen.findByText('REQ-1');
  fireEvent.click(screen.getByText('REQ-1').closest('tr')!);
  await waitFor(() => expect(screen.getByLabelText('From Organization')).toHaveValue('sender'));
  fireEvent.click(await screen.findByRole('button', { name: /Select Transferred Assets Received/i }));
  fireEvent.click(await screen.findByRole('option', { name: /Asset One/ }));
  await waitFor(() => expect(screen.getByTestId('viewer')).toHaveTextContent('REQ-1:asset-1'));

  const requestsBeforeSave = vi.mocked(complianceApi.getDocuments).mock.calls.length;
  fireEvent.click(screen.getByText('Save receipt'));
  await waitFor(() => expect(screen.getByText(/Selected Assets:/).parentElement).toHaveTextContent('Selected Assets: 0'));
  await waitFor(() => expect(screen.getByText('REQ-1').closest('tr')).toHaveAttribute('aria-selected', 'false'));
  await waitFor(() => expect(screen.getByLabelText('From Organization')).toHaveValue(''));
  await screen.findByText('REQ-2');
  expect(screen.getByTestId('viewer')).toHaveTextContent('REQ-1:asset-1');
  await waitFor(() => expect(vi.mocked(complianceApi.getDocuments).mock.calls.length).toBeGreaterThan(requestsBeforeSave));
  fireEvent.click(await screen.findByRole('button', { name: /Select Transferred Assets Received/i }));
  expect(screen.queryByRole('option', { name: /Asset One/ })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Asset Two/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Select Transferred Assets Received/i }));

  state.phase = 'partial';
  fireEvent.click(screen.getByText('Apply receipt'));
  await screen.findByText('PARTIALLY_COMPLETED');
  expect(screen.getByTestId('viewer')).toHaveTextContent('REQ-1:asset-1');

  fireEvent.click(screen.getByText('REQ-1').closest('tr')!);
  await waitFor(() => expect(screen.getByLabelText('From Organization')).toHaveValue('sender'));
  fireEvent.click(await screen.findByRole('button', { name: /Select Transferred Assets Received/i }));
  expect(screen.queryByRole('option', { name: /Asset One/ })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('option', { name: /Asset Two/ }));
  await waitFor(() => expect(screen.getByTestId('viewer')).toHaveTextContent('REQ-1:asset-2'));

  fireEvent.click(screen.getByText('Save receipt'));
  await waitFor(() => expect(screen.getByText(/Selected Assets:/).parentElement).toHaveTextContent('Selected Assets: 0'));
  state.phase = 'complete';
  fireEvent.click(screen.getByText('Apply receipt'));
  await waitFor(() => expect(screen.queryByText('REQ-1')).not.toBeInTheDocument());
  expect(screen.getByText('REQ-2')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('option', { name: 'Sender' })).not.toBeInTheDocument());
  expect(await screen.findByRole('option', { name: 'Sender Two' })).toBeInTheDocument();
  expect(screen.getByTestId('viewer')).toHaveTextContent('REQ-1:asset-2');
});
