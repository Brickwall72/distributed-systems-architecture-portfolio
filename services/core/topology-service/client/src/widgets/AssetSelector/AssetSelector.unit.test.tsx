// File: services/core/topology-service/client/src/widgets/AssetSelector/AssetSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import AssetSelector from './AssetSelector';
import { useAssets } from '../../hooks';
import type { AssetDTOList } from '@contracts/topology';

// Mock the data hook layer to test UI state transitions in isolation
vi.mock('../../hooks', () => ({
  useAssets: vi.fn(),
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
    },
    {
      id: 'ast-002',
      name: 'Radio Unit 2',
      nomenclature: '',
      serialNumber: 'SN-9013',
      currentOwnerId: 'org-01',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when data layer is fetching', () => {
    vi.mocked(useAssets).mockReturnValue({
      items: [],
      isLoading: true,
      error: null,
    });

    render(<AssetSelector onSelect={mockOnSelect} />);

    expect(screen.getByText('Loading assets...')).toBeInTheDocument();
  });

  it('renders error state when hook returns an API error', () => {
    vi.mocked(useAssets).mockReturnValue({
      items: [],
      isLoading: false,
      error: 'Failed to fetch assets from gateway',
    });

    render(<AssetSelector onSelect={mockOnSelect} />);

    // RegExp matches substring alongside "Error: " prefix
    expect(screen.getByText(/Failed to fetch assets from gateway/i)).toBeInTheDocument();
  });

  it('maps AssetDTO items into formatted select options', () => {
    vi.mocked(useAssets).mockReturnValue({
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

  it('emits AssetDTO[] array payload to Shell on user selection', () => {
    vi.mocked(useAssets).mockReturnValue({
      items: mockAssetList,
      isLoading: false,
      error: null,
    });

    render(<AssetSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'ast-001' } });

    // Verify list collection contract payload
    expect(mockOnSelect).toHaveBeenCalledWith([
      {
        id: 'ast-001',
        name: 'AN/PRC-117G',
        nomenclature: 'AN/PRC-117G',
        serialNumber: 'SN-9012',
        currentOwnerId: 'org-01',
      },
    ]);
  });

  it('clears selection and emits empty array when asset is deselected', () => {
    vi.mocked(useAssets).mockReturnValue({
      items: mockAssetList,
      isLoading: false,
      error: null,
    });

    render(<AssetSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });

    expect(mockOnSelect).toHaveBeenCalledWith([]);
  });

  it('safely handles invalid props from Host Shell without crashing render tree', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(useAssets).mockReturnValue({
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
    const { rerender } = render(<AssetSelector onSelect={mockOnSelect} />);

    // 1. Initial render with 2 items
    vi.mocked(useAssets).mockReturnValue({
      items: mockAssetList,
      isLoading: false,
      error: null,
    });

    rerender(<AssetSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'ast-001' } });

    expect(mockOnSelect).toHaveBeenLastCalledWith([mockAssetList[0]]);

    // 2. Data updates (ast-001 filtered out)
    vi.mocked(useAssets).mockReturnValue({
      items: [mockAssetList[1]], // Only ast-002 remains
      isLoading: false,
      error: null,
    });

    rerender(<AssetSelector onSelect={mockOnSelect} />);

    // useEffect hook should detect ast-001 is missing and emit empty array
    expect(mockOnSelect).toHaveBeenLastCalledWith([]);
  });
});