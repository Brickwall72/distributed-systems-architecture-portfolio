// File: services/core/compliance-service/client/src/widgets/CustodyTransferForm.unit.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustodyTransferForm from './CustodyTransferForm.js';
import { Organization, Asset } from '@contracts/domain';

const mockSourceOrg: Organization = {
  id: 'org-1',
  name: 'Alpha Command',
  addressLine1: '123 Base Rd',
  addressLine2: 'Suite 100',
};

const mockTargetOrg: Organization = {
  id: 'org-2',
  name: 'Bravo Logistics',
  addressLine1: '456 Depot Way',
  addressLine2: '',
};

const mockAsset: Asset = {
  id: 'asset-1',
  nomenclature: 'Tactical Radio',
  serialNumber: 'TR-102938',
  ownerId: 'org-1',
};

describe('CustodyTransferForm', () => {
  it('renders correctly with default requisition number and invalid state when props are missing', () => {
    const mockChildren = vi.fn().mockReturnValue(<div>Child Content</div>);

    render(
      <CustodyTransferForm sourceOrg={null} targetOrg={null} asset={null}>
        {mockChildren}
      </CustodyTransferForm>
    );

    expect(screen.getByText('DD-1149 Custody Transfer Orchestrator')).toBeInTheDocument();
    
    const input = screen.getByLabelText(/Requisition Control Number/i) as HTMLInputElement;
    expect(input.value).toBe('REQ-2026-001');

    // Verify children received invalid validation result due to missing required fields
    expect(mockChildren).toHaveBeenCalledTimes(1);
    const [, isValid] = mockChildren.mock.calls[0];
    expect(isValid).toBe(false);
  });

  it('evaluates to valid and builds correct payload when valid organizations and asset are provided', () => {
    const mockChildren = vi.fn().mockReturnValue(<div>Child Content</div>);

    render(
      <CustodyTransferForm 
        sourceOrg={mockSourceOrg} 
        targetOrg={mockTargetOrg} 
        asset={mockAsset}
      >
        {mockChildren}
      </CustodyTransferForm>
    );

    const [payload, isValid] = mockChildren.mock.calls[mockChildren.mock.calls.length - 1];

    expect(isValid).toBe(true);
    expect(payload).toEqual(
      expect.objectContaining({
        fromEntityName: 'Alpha Command',
        fromAddressLine1: '123 Base Rd',
        toEntityName: 'Bravo Logistics',
        toAddressLine1: '456 Depot Way',
        requisitionNumber: 'REQ-2026-001',
        items: [
          expect.objectContaining({
            itemNumber: 1,
            nomenclature: 'Tactical Radio',
            serialNumber: 'TR-102938',
            unit: 'EA',
            quantity: 1,
          }),
        ],
      })
    );
  });

  it('updates requisition number and reflects the change in the payload', async () => {
    const user = userEvent.setup();
    const mockChildren = vi.fn().mockReturnValue(<div>Child Content</div>);

    render(
      <CustodyTransferForm 
        sourceOrg={mockSourceOrg} 
        targetOrg={mockTargetOrg} 
        asset={mockAsset}
      >
        {mockChildren}
      </CustodyTransferForm>
    );

    const input = screen.getByLabelText(/Requisition Control Number/i);
    await user.clear(input);
    await user.type(input, 'REQ-NEW-999');

    // Get the latest render call arguments
    const [latestPayload] = mockChildren.mock.calls[mockChildren.mock.calls.length - 1];
    expect(latestPayload.requisitionNumber).toBe('REQ-NEW-999');
  });
});