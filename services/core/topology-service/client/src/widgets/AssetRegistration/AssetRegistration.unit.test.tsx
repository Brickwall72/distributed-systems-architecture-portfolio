// File: services/core/topology-service/client/src/widgets/AssetRegistration/AssetRegistration.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssetRegistrationWidget, { TOPOLOGY_MUTATION_EVENT } from './AssetRegistration';
import { useCreateAsset } from '../../hooks';

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
        onClick={() => onSelect([{ id: 'org-10', name: 'Test Org' }])}
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
    mockCreateAsset.mockResolvedValueOnce({ id: 'asset-gps-12' });
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<AssetRegistrationWidget />);

    fireEvent.change(screen.getByLabelText(/Asset ID \(UUID \/ URI\)/i), {
      target: { value: 'asset-gps-12' },
    });
    fireEvent.change(screen.getByLabelText(/Asset Name/i), {
      target: { value: 'GPS Navigation Unit' },
    });
    fireEvent.change(screen.getByLabelText(/Nomenclature/i), {
      target: { value: 'GPS-III SV' },
    });
    fireEvent.change(screen.getByLabelText(/Serial Number/i), {
      target: { value: 'SN-998273' },
    });

    // Select holding organization custody
    fireEvent.click(screen.getByTestId('mock-org-selector'));

    const submitBtn = screen.getByRole('button', { name: /Register & Assign Custody/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateAsset).toHaveBeenCalledWith({
        id: 'asset-gps-12',
        name: 'GPS Navigation Unit',
        nomenclature: 'GPS-III SV',
        serialNumber: 'SN-998273',
        status: 'AVAILABLE',
        currentOwnerId: 'org-10',
      });
    });

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: TOPOLOGY_MUTATION_EVENT })
    );

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