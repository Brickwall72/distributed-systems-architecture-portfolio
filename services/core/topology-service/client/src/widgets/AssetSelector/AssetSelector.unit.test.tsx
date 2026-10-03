// File: services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetSelector from './AssetSelector';
import { useAssets } from '../../hooks';

vi.mock('../../hooks', () => ({
  useAssets: vi.fn(),
}));

describe('AssetSelector Widget', () => {
  const mockUseAssets = vi.mocked(useAssets);
  const mockOnChange = vi.fn();

  const mockAssets = [
    {
      id: 'ast-101',
      nomenclature: 'Radio Transceiver',
      serialNumber: 'SN-001',
      currentOwnerId: 'org-1',
    },
    {
      id: 'ast-102',
      nomenclature: 'Satellite Terminal',
      serialNumber: 'SN-002',
      currentOwnerId: 'org-1',
    },
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes filtering params correctly to useAssets', () => {
    mockUseAssets.mockReturnValue({ items: [], isLoading: true, error: null });

    render(
      <AssetSelector
        label="Select Asset"
        ownerId="org-1"
        excludeOwnerId="org-2"
        onChange={mockOnChange}
      />
    );

    expect(mockUseAssets).toHaveBeenCalledWith({
      ownerId: 'org-1',
      excludeOwnerId: 'org-2',
    });
  });

  it('renders loading state when fetching assets', () => {
    mockUseAssets.mockReturnValue({ items: [], isLoading: true, error: null });

    render(<AssetSelector label="Select Asset" onChange={mockOnChange} />);

    expect(screen.getByText('Loading assets...')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders error state when hook returns error', () => {
    mockUseAssets.mockReturnValue({
      items: [],
      isLoading: false,
      error: 'Failed to load items',
    });

    render(<AssetSelector label="Select Asset" onChange={mockOnChange} />);

    expect(screen.getByText('Error: Failed to load items')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('maps asset items to options and triggers onChange with the full domain object on selection', async () => {
    const user = userEvent.setup();
    mockUseAssets.mockReturnValue({
      items: mockAssets,
      isLoading: false,
      error: null,
    });

    render(
      <AssetSelector
        label="Select Asset"
        selectedId="ast-101"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Select Asset' });
    expect(select).toHaveValue('ast-101');

    // Verify option label formatting: `${nomenclature} (S/N: ${serialNumber})`
    expect(
      screen.getByRole('option', { name: 'Radio Transceiver (S/N: SN-001)' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Satellite Terminal (S/N: SN-002)' })
    ).toBeInTheDocument();

    // Select second option
    await user.selectOptions(select, 'ast-102');

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(mockAssets[1]);
  });

  it('calls onChange with null when selecting the default empty placeholder', () => {
    mockUseAssets.mockReturnValue({
      items: mockAssets,
      isLoading: false,
      error: null,
    });

    render(
      <AssetSelector
        label="Select Asset"
        selectedId="ast-101"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Select Asset' });

    fireEvent.change(select, { target: { value: '' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });
});