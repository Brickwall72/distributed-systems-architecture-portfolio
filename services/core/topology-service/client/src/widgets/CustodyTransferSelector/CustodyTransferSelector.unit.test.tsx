// File: services/core/topology-service/client/src/widgets/CustodyTransferSelector/CustodyTransferSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustodyTransferSelector from './CustodyTransferSelector';
import { Organization, Asset } from '@contracts/custody';

// Mock child selectors to test orchestration logic in isolation
vi.mock('../OrganizationSelector/OrganizationSelector', () => ({
  default: ({ label, selectedId, excludeId, onChange }: any) => (
    <div data-testid={`org-selector-${label}`}>
      <span>{label}</span>
      <span data-testid={`selected-${label}`}>{selectedId ?? 'none'}</span>
      <span data-testid={`excluded-${label}`}>{excludeId ?? 'none'}</span>
      <button
        onClick={() =>
          onChange({
            id: label.includes('Transferring') ? 'org-source-1' : 'org-target-2',
            name: label.includes('Transferring') ? '1st Battalion' : '2nd Battalion',
            type: label.includes('Transferring') ? 'CONTRACTOR' : 'GOVERNMENT',
          } as Organization)
        }
      >
        Select {label}
      </button>
      <button onClick={() => onChange(null)}>Clear {label}</button>
    </div>
  ),
}));

vi.mock('../AssetSelector/AssetSelector', () => ({
  default: ({ label, selectedId, ownerId, onChange }: any) => (
    <div data-testid="asset-selector">
      <span>{label}</span>
      <span data-testid="asset-selected">{selectedId ?? 'none'}</span>
      <span data-testid="asset-owner">{ownerId ?? 'none'}</span>
      <button
        onClick={() =>
          onChange({
            id: 'asset-99',
            nomenclature: 'M240B Machine Gun',
            serialNumber: 'SN-99823',
          } as Asset)
        }
      >
        Select Asset
      </button>
      <button onClick={() => onChange(null)}>Clear Asset</button>
    </div>
  ),
}));

describe('CustodyTransferSelector', () => {
  const mockOnStateChange = vi.fn();

  const mockSourceOrg: Organization = {
    id: 'org-source-1',
    name: '1st Battalion',
    type: 'CONTRACTOR',
  } as Organization;

  const mockTargetOrg: Organization = {
    id: 'org-target-2',
    name: '2nd Battalion',
    type: 'GOVERNMENT',
  } as Organization;

  const mockAsset: Asset = {
    id: 'asset-99',
    nomenclature: 'M240B Machine Gun',
    serialNumber: 'SN-99823',
  } as Asset;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits initial null state on mount', () => {
    render(<CustodyTransferSelector onStateChange={mockOnStateChange} />);

    expect(mockOnStateChange).toHaveBeenCalledWith({
      sourceOrg: null,
      targetOrg: null,
      asset: null,
    });
  });

  it('passes mutual exclusion IDs between source and target selectors', () => {
    render(<CustodyTransferSelector onStateChange={mockOnStateChange} />);

    // Select source org
    fireEvent.click(screen.getByText('Select 1. Transferring Entity (From)'));

    // Target selector should now receive sourceOrg.id as its excludeId
    expect(screen.getByTestId('excluded-3. Receiving Entity (To)').textContent).toBe('org-source-1');

    // Select target org
    fireEvent.click(screen.getByText('Select 3. Receiving Entity (To)'));

    // Source selector should now receive targetOrg.id as its excludeId
    expect(screen.getByTestId('excluded-1. Transferring Entity (From)').textContent).toBe('org-target-2');

    // Verify aggregated state update includes both source and target orgs
    expect(mockOnStateChange).toHaveBeenLastCalledWith({
      sourceOrg: mockSourceOrg,
      targetOrg: mockTargetOrg,
      asset: null,
    });
  });

  it('passes sourceOrg.id as ownerId to the AssetSelector', () => {
    render(<CustodyTransferSelector onStateChange={mockOnStateChange} />);

    expect(screen.getByTestId('asset-owner').textContent).toBe('none');

    fireEvent.click(screen.getByText('Select 1. Transferring Entity (From)'));

    expect(screen.getByTestId('asset-owner').textContent).toBe('org-source-1');
  });

  it('automatically clears selected asset when source organization changes', () => {
    render(<CustodyTransferSelector onStateChange={mockOnStateChange} />);

    // 1. Select Source Org
    fireEvent.click(screen.getByText('Select 1. Transferring Entity (From)'));
    // 2. Select Asset
    fireEvent.click(screen.getByText('Select Asset'));

    expect(mockOnStateChange).toHaveBeenLastCalledWith({
      sourceOrg: mockSourceOrg,
      targetOrg: null,
      asset: mockAsset,
    });

    // 3. Clear/Change Source Org
    fireEvent.click(screen.getByText('Clear 1. Transferring Entity (From)'));

    // Asset should be automatically reset to null
    expect(mockOnStateChange).toHaveBeenLastCalledWith({
      sourceOrg: null,
      targetOrg: null,
      asset: null,
    });
  });
});