// File: ui-shells/domain-shells/compoliance-shell/src/pages/TransferReceipt/TransferReceiptPage.unit.test.tsx
import { act, render, screen } from '@testing-library/react';
import { setTestSession } from '@shared/testing';
import { FORM_ID, type DocumentsTableInput, type ComplianceWorkflowWidgetProps } from '@contracts/compliance';
import { TOPOLOGY_GRAPH_QUERY_KEY, type MultiAssetSelectorProps, type SingleOrganizationSelectorProps } from '@contracts/topology';
import TransferReceiptPage from './TransferReceipt.page';

const { remote } = vi.hoisted(() => ({ remote: { props: {} as Record<string, unknown> } }));

vi.mock('@shared/mf-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/mf-runtime')>();
  return {
    ...actual,
    lazyRemote: (id: string) => (props: { label?: string }) => {
      remote.props[`${id}:${props.label ?? ''}`] = props;
      return <div data-testid={id} />;
    },
  };
});

it('requests the receiving-organization document view on the receipt page', async () => {
  setTestSession();
  render(<TransferReceiptPage />);
  await screen.findByTestId('compliance_client/DocumentsTable');
  expect((remote.props['compliance_client/DocumentsTable:'] as DocumentsTableInput).receivingOrganizationOnly).toBe(true);
});

it('refreshes receipt inputs after application while preserving the signed workflow until a user selection', () => {
  setTestSession();
  render(<TransferReceiptPage />);
  const table = () => remote.props['compliance_client/DocumentsTable:'] as DocumentsTableInput;
  const source = () => remote.props['topology_client/OrganizationSelector:From Organization'] as SingleOrganizationSelectorProps;
  const receiver = () => remote.props['topology_client/OrganizationSelector:Receiving Organization'] as SingleOrganizationSelectorProps;
  const assets = () => remote.props['topology_client/AssetSelector:Select Transferred Assets Received'] as MultiAssetSelectorProps;
  const workflow = () => remote.props['compliance_client/ComplianceWorkflowWidget:'] as ComplianceWorkflowWidgetProps;
  const asset = { id: 'asset-1', name: 'Asset', nomenclature: 'Asset', serialNumber: '1', status: 'IN_TRANSIT' as const, type: 'ASSET', controlType: 'LOCAL' as const, currentOwnerId: 'source' };

  act(() => {
    source().onSelect({ id: 'source', name: 'Source', type: 'CONTRACTOR', requisitions: ['REQ-1'] });
    receiver().onSelect({ id: 'org-test', name: 'Receiver', type: 'GOV_AGENCY', requisitions: ['REQ-1'] });
    assets().onSelect([asset]);
    table().onTransferEventSelect?.('12345678-1234-1234-1234-123456789012');
    table().onRequisitionNumberSelect?.('REQ-1');
    table().onAuthorizingTemplateSelect?.(FORM_ID.ASSET_TRANSFER_AUTHORIZATION);
  });
  act(() => workflow().onDocumentSaved?.('document-1'));
  expect(table().refreshKey).toBe(1);
  expect(source().autoSelectSingle).toBe(false);
  expect(assets().transferEventId).toBeUndefined();
  expect(table().requisitionNumbers).toBeUndefined();
  expect(workflow()).toMatchObject({ assets: [asset], requisitionNumber: 'REQ-1', resetKey: 0, invalidateQueryKeys: [TOPOLOGY_GRAPH_QUERY_KEY] });
  act(() => workflow().onTopologyApplied?.('document-1'));
  expect(table().refreshKey).toBe(2);
  expect(source().refreshKey).toBe(2);
  expect(receiver().refreshKey).toBe(2);
  expect(assets().refreshKey).toBe(2);

  act(() => {
    assets().onSelect([]);
    source().onSelect(undefined);
    table().onTransferEventSelect?.(undefined);
    table().onRequisitionNumberSelect?.(undefined);
    table().onAuthorizingTemplateSelect?.(undefined);
  });
  expect(workflow()).toMatchObject({ assets: [asset], requisitionNumber: 'REQ-1', resetKey: 0 });

  act(() => table().onUserSelect?.());
  expect(workflow()).toMatchObject({ assets: [], requisitionNumber: undefined, resetKey: 1 });
  const nextAsset = { ...asset, id: 'asset-2' };
  act(() => assets().onSelect([nextAsset]));
  act(() => workflow().onTopologyApplied?.('document-1'));
  expect(workflow().assets).toEqual([nextAsset]);
});
