// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import OrganizationSelector from './OrganizationSelector';
import { useOrganizations } from '../../hooks';
import type { OrganizationDTOList } from 'topology-shared';

// Mock the data hook layer to test UI state transitions in isolation
vi.mock('../../hooks', () => ({
  useOrganizations: vi.fn(),
}));

describe('OrganizationSelector Widget (UI Boundary)', () => {
  const mockOnSelect = vi.fn();

  const mockOrgList: OrganizationDTOList = [
    {
      id: 'org-001',
      name: 'Space Systems Command',
      type: 'MILITARY_BRANCH',
      addressLine1: 'Building 2730',
      addressLine2: 'El Segundo, CA',
    },
    {
      id: 'org-002',
      name: 'General Dynamics',
      type: 'CONTRACTOR',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when data layer is fetching', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: [],
      isLoading: true,
      error: null,
    });

    render(<OrganizationSelector onSelect={mockOnSelect} />);

    expect(screen.getByText('Loading organizations...')).toBeInTheDocument();
  });

  it('renders error state when hook returns an API error', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: [],
      isLoading: false,
      error: 'Failed to fetch organizations from gateway',
    });

    render(<OrganizationSelector onSelect={mockOnSelect} />);

    expect(screen.getByText(/Failed to fetch organizations from gateway/i)).toBeInTheDocument();
  });

  it('maps OrganizationDTO items into select options', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    render(<OrganizationSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    expect(screen.getByText('Space Systems Command')).toBeInTheDocument();
    expect(screen.getByText('General Dynamics')).toBeInTheDocument();
  });

  it('filters out organization matching excludeOrgId prop', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    render(<OrganizationSelector excludeOrgId="org-001" onSelect={mockOnSelect} />);

    expect(screen.queryByText('Space Systems Command')).not.toBeInTheDocument();
    expect(screen.getByText('General Dynamics')).toBeInTheDocument();
  });

  it('emits OrganizationBase[] array payload to Shell on user selection', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    render(<OrganizationSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'org-001' } });

    expect(mockOnSelect).toHaveBeenCalledWith([
      {
        id: 'org-001',
        name: 'Space Systems Command',
        type: 'MILITARY_BRANCH',
        addressLine1: 'Building 2730',
        addressLine2: 'El Segundo, CA',
      },
    ]);
  });

  it('clears selection and emits empty array when organization is deselected', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    render(<OrganizationSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });

    expect(mockOnSelect).toHaveBeenCalledWith([]);
  });

  it('safely handles invalid props from Host Shell without crashing render tree', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(useOrganizations).mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
    });

    // Pass invalid prop shape (filterOwnedId should be string, passing number)
    const invalidProps = {
      filterOwnedId: 12345 as unknown as string,
      onSelect: mockOnSelect,
    };

    render(<OrganizationSelector {...invalidProps} />);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OrganizationSelector MFE] Invalid props received'),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it('resets selection if currently selected organization disappears after filter update', () => {
    const { rerender } = render(<OrganizationSelector onSelect={mockOnSelect} />);

    // 1. Initial render with 2 items
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    rerender(<OrganizationSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'org-001' } });

    expect(mockOnSelect).toHaveBeenLastCalledWith([mockOrgList[0]]);

    // 2. Data updates (org-001 filtered out)
    vi.mocked(useOrganizations).mockReturnValue({
      items: [mockOrgList[1]], // Only org-002 remains
      isLoading: false,
      error: null,
    });

    rerender(<OrganizationSelector onSelect={mockOnSelect} />);

    // useEffect hook detects org-001 is missing and emits empty array
    expect(mockOnSelect).toHaveBeenLastCalledWith([]);
  });
});