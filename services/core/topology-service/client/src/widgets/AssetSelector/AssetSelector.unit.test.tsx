// File: services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import AssetSelector from './AssetSelector';
import { useGetAssets } from '../../hooks';
import type { AssetDTOList } from '@contracts/topology';

// Mock the data hook layer to test UI state transitions in isolation
vi.mock('../../hooks', () => ({
  useGetAssets: vi.fn(),
}));

describe('AssetSelector Widget (UI Boundary)', () => {
  const mockOnSelect = vi.fn();

  const mockAssetList: AssetDTOList = [
    {
      id: 'ast-001',
      name: 'AN/PRC-117G',
      nomenclature: 'AN/PRC-117G',
      serialNumber: 'SN-9012',
      currentOwnerId: 'org-01',
      status: 'AVAILABLE',
      type: 'RADIO',
      controlType: 'LOCAL',
    },
    {
      id: 'ast-002',
      name: 'Radio Unit 2',
      nomenclature: '',
      serialNumber: 'SN-9013',
      currentOwnerId: 'org-01',
      status: 'AVAILABLE',
      type: 'RADIO',
      controlType: 'LOCAL',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when data layer is fetching', () => {
    vi.mocked(useGetAssets).mockReturnValue({
      items: [],
      isLoading: true,
      error: null,
    });

    render(<AssetSelector onSelect={mockOnSelect} />);

    expect(screen.getByText('Loading assets...')).toBeInTheDocument();
  });

  it('renders error state when hook returns an API error', () => {
    vi.mocked(useGetAssets).mockReturnValue({
      items: [],
      isLoading: false,
      error: 'Failed to fetch assets from gateway',
    });

    render(<AssetSelector onSelect={mockOnSelect} />);

    // RegExp matches substring alongside "Error: " prefix
    expect(screen.getByText(/Failed to fetch assets from gateway/i)).toBeInTheDocument();
  });

  it('maps AssetDTO items into formatted select options', () => {
    vi.mocked(useGetAssets).mockReturnValue({
      items: mockAssetList,
      isLoading: false,
      error: null,
    });

    render(<AssetSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Verify option labels maintain fallback formatting rules: nomenclature ?? name
    expect(screen.getByText('AN/PRC-117G (S/N: SN-9012)')).toBeInTheDocument();
    expect(screen.getByText('Radio Unit 2 (S/N: SN-9013)')).toBeInTheDocument();
  });

  it('defaults to single-select and emits a single AssetDTO', () => {
    vi.mocked(useGetAssets).mockReturnValue({ items: mockAssetList, isLoading: false, error: null });

    render(<AssetSelector onSelect={mockOnSelect} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ast-001' } });
    expect(mockOnSelect).toHaveBeenLastCalledWith(mockAssetList[0]);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(mockOnSelect).toHaveBeenLastCalledWith(null);
  });

  it('includes in-transit assets by default', () => {
    vi.mocked(useGetAssets).mockReturnValue({ items: [], isLoading: false, error: null });

    render(<AssetSelector onSelect={mockOnSelect} />);

    expect(useGetAssets).toHaveBeenLastCalledWith(expect.objectContaining({ includeInTransit: true }));
  });

  it('forwards an explicit includeInTransit={false} to the data layer', () => {
    vi.mocked(useGetAssets).mockReturnValue({ items: [], isLoading: false, error: null });

    render(<AssetSelector includeInTransit={false} onSelect={mockOnSelect} />);

    expect(useGetAssets).toHaveBeenLastCalledWith(expect.objectContaining({ includeInTransit: false }));
  });

  it('emits AssetDTO[] array payload to Shell on user selection', () => {
    vi.mocked(useGetAssets).mockReturnValue({
      items: mockAssetList,
      isLoading: false,
      error: null,
    });

    render(<AssetSelector multiSelect onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Asset Select' }));
    fireEvent.click(screen.getByRole('option', { name: /AN\/PRC-117G/ }));

    // Verify list collection contract payload
    expect(mockOnSelect).toHaveBeenCalledWith([
      {
        id: 'ast-001',
        name: 'AN/PRC-117G',
        nomenclature: 'AN/PRC-117G',
        serialNumber: 'SN-9012',
        currentOwnerId: 'org-01',
        status: 'AVAILABLE',
        type: 'RADIO',
        controlType: 'LOCAL',
      },
    ]);
  });

  it('clears selection and emits empty array when asset is deselected', () => {
    vi.mocked(useGetAssets).mockReturnValue({
      items: mockAssetList,
      isLoading: false,
      error: null,
    });

    render(<AssetSelector multiSelect onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Asset Select' }));
    const option = screen.getByRole('option', { name: /AN\/PRC-117G/ });
    fireEvent.click(option);
    fireEvent.click(option);

    expect(mockOnSelect).toHaveBeenLastCalledWith([]);
  });

  it('safely handles invalid props from Host Shell without crashing render tree', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(useGetAssets).mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
    });

    // Pass invalid prop shape (filterOwnerId should be string, passing number)
    const invalidProps = {
      filterOwnerId: 12345 as unknown as string,
      onSelect: mockOnSelect,
    };

    render(<AssetSelector {...invalidProps} />);

    // Verify console warning was logged rather than uncaught exception throw
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AssetSelector MFE] Invalid props received'),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it('resets selection if currently selected asset disappears after filter update', () => {
    const { rerender } = render(<AssetSelector multiSelect onSelect={mockOnSelect} />);

    // 1. Initial render with 2 items
    vi.mocked(useGetAssets).mockReturnValue({
      items: mockAssetList,
      isLoading: false,
      error: null,
    });

    rerender(<AssetSelector multiSelect onSelect={mockOnSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Asset Select' }));
    fireEvent.click(screen.getByRole('option', { name: /AN\/PRC-117G/ }));

    expect(mockOnSelect).toHaveBeenLastCalledWith([mockAssetList[0]]);

    // 2. Data updates (ast-001 filtered out)
    vi.mocked(useGetAssets).mockReturnValue({
      items: [mockAssetList[1]], // Only ast-002 remains
      isLoading: false,
      error: null,
    });

    rerender(<AssetSelector multiSelect onSelect={mockOnSelect} />);

    // useEffect hook should detect ast-001 is missing and emit empty array
    expect(mockOnSelect).toHaveBeenLastCalledWith([]);
  });
});