import { act, render } from '@testing-library/react';
import { mockFromSchema } from '@shared/testing';
import { CONTROL_TYPE, AssetDTOSchema, OrganizationDTOSchema, type AssetDTO, type OrganizationDTO } from '@contracts/topology';
import { TRANSFER_TYPE } from '@contracts/common';
import { ComplianceWorkflowWidgetPropsSchema } from '@contracts/compliance';
import UnifiedCustodyPage from './UnifiedCustodyPage';

type Props = Record<string, any>;

// Stub remotes record the props the page hands them, keyed by module and label
const remotes = vi.hoisted(() => ({ props: {} as Record<string, Props> }));

vi.mock('../utils/federation', async () => {
  const React = await import('react');
  return {
    lazyRemote: (moduleName: string) => (props: Props) => {
      remotes.props[`${moduleName}:${props.label ?? ''}`] = props;
      return React.createElement('div', { 'data-testid': moduleName });
    },
  };
});

const SOURCE = 'topology_client/OrganizationSelector:Source Organization';
const TARGET = 'topology_client/OrganizationSelector:Target Organization';
const ASSET = 'topology_client/AssetSelector:Asset for Transfer';
const WORKFLOW = 'compliance_client/ComplianceWorkflowWidget:';

describe('UnifiedCustodyPage', () => {
  // zocker can't generate `.trim().min()` chains, so those fields are supplied
  const makeOrg = (id: string): OrganizationDTO =>
    mockFromSchema(OrganizationDTOSchema, { id, name: `Org ${id}`, addressLine1: undefined, addressLine2: undefined });
  const makeAsset = (overrides: Partial<AssetDTO> = {}): AssetDTO =>
    mockFromSchema(AssetDTOSchema, { name: 'Asset', currentOwnerId: 'org-source', ...overrides });

  const select = (key: string, value: unknown) => act(() => remotes.props[key].onSelect(value));

  beforeEach(() => {
    remotes.props = {};
    render(<UnifiedCustodyPage />);
  });

  it('mounts the workflow widget with props that satisfy its contract before anything is selected', () => {
    const { onSelect, ...data } = remotes.props[WORKFLOW];

    expect(ComplianceWorkflowWidgetPropsSchema.safeParse(data).success).toBe(true);
    expect(data).toMatchObject({ assets: [], sourceOrg: undefined, targetOrg: undefined, transferType: undefined });
    expect(onSelect).toBeTypeOf('function');
  });

  it('forwards selector outputs to the workflow widget as valid props', () => {
    const source = makeOrg('org-source');
    const target = makeOrg('org-target');
    const asset = makeAsset({ controlType: CONTROL_TYPE.LOCAL });

    select(SOURCE, [source]);
    select(TARGET, [target]);
    select(ASSET, [asset]);

    const { onSelect: _onSelect, ...data } = remotes.props[WORKFLOW];
    const parsed = ComplianceWorkflowWidgetPropsSchema.parse(data);

    expect(parsed.sourceOrg?.id).toBe(source.id);
    expect(parsed.sourceOrg?.name).toBe(source.name);
    expect(parsed.targetOrg?.id).toBe(target.id);
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.assets[0]).toMatchObject({
      id: asset.id,
      nomenclature: asset.nomenclature,
      serialNumber: asset.serialNumber,
    });
  });

  it('only passes the first organization chosen by a selector', () => {
    const [first, second] = [makeOrg('org-a'), makeOrg('org-b')];

    select(SOURCE, [first, second]);

    expect(remotes.props[WORKFLOW].sourceOrg.id).toBe(first.id);
  });

  it('clears workflow entities when selectors report an empty selection', () => {
    select(SOURCE, [makeOrg('org-source')]);
    select(ASSET, [makeAsset()]);
    select(SOURCE, []);
    select(ASSET, []);

    expect(remotes.props[WORKFLOW]).toMatchObject({ sourceOrg: undefined, assets: [] });
  });

  it.each([
    [CONTROL_TYPE.LOCAL, TRANSFER_TYPE.PHYSICAL_TRANSFER],
    [CONTROL_TYPE.REMOTE, TRANSFER_TYPE.C2_TRANSFER],
  ])('derives the %s asset control type into the %s transfer type', (controlType, transferType) => {
    select(ASSET, [makeAsset({ controlType })]);

    expect(remotes.props[WORKFLOW].transferType).toBe(transferType);
  });

  it('drops the transfer type when the asset is deselected', () => {
    select(ASSET, [makeAsset({ controlType: CONTROL_TYPE.LOCAL })]);
    select(ASSET, []);

    expect(remotes.props[WORKFLOW].transferType).toBeUndefined();
  });

  it('narrows the asset selector by control type when the workflow reports a transfer type', () => {
    expect(remotes.props[ASSET].filterControlType).toBeUndefined();

    act(() => remotes.props[WORKFLOW].onSelect(TRANSFER_TYPE.C2_TRANSFER));
    expect(remotes.props[ASSET].filterControlType).toBe(CONTROL_TYPE.REMOTE);
    expect(remotes.props[WORKFLOW].transferType).toBe(TRANSFER_TYPE.C2_TRANSFER);

    act(() => remotes.props[WORKFLOW].onSelect(TRANSFER_TYPE.PHYSICAL_TRANSFER));
    expect(remotes.props[ASSET].filterControlType).toBe(CONTROL_TYPE.LOCAL);

    act(() => remotes.props[WORKFLOW].onSelect(undefined));
    expect(remotes.props[ASSET].filterControlType).toBeUndefined();
    expect(remotes.props[WORKFLOW].transferType).toBeUndefined();
  });

  it('explicitly excludes in-transit assets from the asset selector', () => {
    expect(remotes.props[ASSET].includeInTransit).toBe(false);
  });

  it('cross-filters the selectors using one another’s outputs', () => {
    const source = makeOrg('org-source');
    const target = makeOrg('org-target');
    const asset = makeAsset();

    select(SOURCE, [source]);
    select(TARGET, [target]);
    select(ASSET, [asset]);

    expect(remotes.props[SOURCE]).toMatchObject({ excludeOrgId: target.id, filterOwnedId: asset.id, requireActiveAssets: true });
    expect(remotes.props[ASSET]).toMatchObject({ excludeOwnerId: target.id, filterOwnerId: source.id });
    expect(remotes.props[TARGET]).toMatchObject({ excludeOrgId: source.id });
  });
});
