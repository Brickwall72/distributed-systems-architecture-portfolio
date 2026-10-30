// File: services/core/topology-service/client/src/widgets/AssetRegistration/AssetRegistration.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssetRegistrationWidget, { TOPOLOGY_MUTATION_EVENT } from './AssetRegistration';
import { useCreateAsset } from '../../hooks';
import { AssetDTOSchema } from '@contracts/topology';
import { mockFromSchema } from '@shared/testing';

const { mockOrg } = vi.hoisted(() => ({ mockOrg: { id: 'org-10', name: 'Test Org' } }));

vi.mock('../../hooks', () => ({
  useCreateAsset: vi.fn(),
}));

vi.mock('../OrganizationSelector', () => ({
  default: ({ label, onSelect }: any) => (
    <div>
      <label>{label}</label>
      <button
        type="button"
        data-testid="mock-org-selector"
        onClick={() => onSelect([mockOrg])}
      >
        Select Org
      </button>
    </div>
  ),
}));

describe('AssetRegistrationWidget', () => {
  const mockCreateAsset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateAsset).mockReturnValue({
      createAsset: mockCreateAsset,
      isLoading: false,
      error: null,
    });
  });

  it('renders correctly and shows validation error when submitting empty form', async () => {
    render(<AssetRegistrationWidget />);

    expect(screen.getByText('Register New Asset')).toBeInTheDocument();

    const form = screen.getByRole('button', { name: /Register & Assign Custody/i }).closest('form')!;
    
    // Dispatch submit event directly to bypass HTML5 required validation blocking in JSDOM
    fireEvent.submit(form);

    expect(
      await screen.findByText('All fields including holding organization custody are required.')
    ).toBeInTheDocument();
    expect(mockCreateAsset).not.toHaveBeenCalled();
  });

  it('successfully submits valid asset payload, dispatches mutation event, and resets form', async () => {
    // Text inputs drop line breaks, so keep generated values single-line
    const singleLine = (value: string) => value.replaceAll(/\s+/g, ' ').trim();
    const generated = mockFromSchema(AssetDTOSchema, { name: 'GPS Navigation Unit', currentOwnerId: mockOrg.id, id: 'asset-gps-12' });
    const asset = { ...generated, nomenclature: singleLine(generated.nomenclature), serialNumber: singleLine(generated.serialNumber) };
    mockCreateAsset.mockResolvedValueOnce({ id: asset.id });
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<AssetRegistrationWidget />);

    fireEvent.change(screen.getByLabelText(/Asset ID \(UUID \/ URI\)/i), { target: { value: asset.id } });
    fireEvent.change(screen.getByLabelText(/Asset Name/i), { target: { value: asset.name } });
    fireEvent.change(screen.getByLabelText(/Nomenclature/i), { target: { value: asset.nomenclature } });
    fireEvent.change(screen.getByLabelText(/Serial Number/i), { target: { value: asset.serialNumber } });
    fireEvent.change(screen.getByLabelText(/Control Type/i), { target: { value: asset.controlType } });
    fireEvent.click(screen.getByTestId('mock-org-selector'));

    fireEvent.click(screen.getByRole('button', { name: /Register & Assign Custody/i }));

    await waitFor(() => {
      expect(mockCreateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          id: asset.id,
          name: asset.name,
          nomenclature: asset.nomenclature,
          serialNumber: asset.serialNumber,
          status: 'AVAILABLE',
          controlType: asset.controlType,
          currentOwnerId: mockOrg.id,
        })
      );
    });
    expect(AssetDTOSchema.safeParse(mockCreateAsset.mock.calls[0][0]).success).toBe(true);

    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: TOPOLOGY_MUTATION_EVENT }));
    expect(screen.getByLabelText(/Asset ID \(UUID \/ URI\)/i)).toHaveValue('');
  });

  it('displays API error when createAsset hook reports an error', () => {
    vi.mocked(useCreateAsset).mockReturnValue({
      createAsset: mockCreateAsset,
      isLoading: false,
      error: 'Conflict: Asset ID already exists',
    });

    render(<AssetRegistrationWidget />);

    expect(screen.getByText('Conflict: Asset ID already exists')).toBeInTheDocument();
  });
});