// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import OrganizationSelector from './OrganizationSelector';
import { useOrganizations } from '../../hooks';
import type { OrganizationDTOList } from '@contracts/topology';

// Mock the data hook layer to test UI state transitions in isolation
vi.mock('../../hooks', () => ({
  useOrganizations: vi.fn(),
}));

describe('OrganizationSelector Widget (UI Boundary & Interaction State Machine)', () => {
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

  it('maps OrganizationDTO items into select options when multiple options exist', () => {
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
    // Ensures no auto-selection occurs when multiple options exist
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('filters out excluded organization and auto-selects when only one option remains', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    render(<OrganizationSelector excludeOrgId="org-001" onSelect={mockOnSelect} />);

    expect(screen.queryByText('Space Systems Command')).not.toBeInTheDocument();
    expect(screen.getByText('General Dynamics')).toBeInTheDocument();

    // Auto-selects General Dynamics because it is the sole remaining option
    expect(mockOnSelect).toHaveBeenCalledWith([mockOrgList[1]]);
  });

  it('bypasses excludeOrgId when filterOwnedId returns exactly one holding organization (Precedence Rule)', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: [mockOrgList[0]], // Only org-001 owns this asset
      isLoading: false,
      error: null,
    });

    render(
      <OrganizationSelector
        filterOwnedId="asset-3333"
        excludeOrgId="org-001"
        onSelect={mockOnSelect}
      />
    );

    // Precedence rule preserves org-001 despite excludeOrgId and auto-selects it
    expect(screen.getByText('Space Systems Command')).toBeInTheDocument();
    expect(mockOnSelect).toHaveBeenCalledWith([mockOrgList[0]]);
  });

  it('emits OrganizationBase[] array payload to Shell on explicit user selection', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    render(<OrganizationSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'org-001' } });

    expect(mockOnSelect).toHaveBeenCalledWith([mockOrgList[0]]);
  });

  it('allows explicit user deselection and prevents re-auto-selection', () => {
    vi.mocked(useOrganizations).mockReturnValue({
      items: [mockOrgList[0]], // Single item pool
      isLoading: false,
      error: null,
    });

    render(<OrganizationSelector onSelect={mockOnSelect} />);

    // 1. Initial render auto-selects single option
    expect(mockOnSelect).toHaveBeenLastCalledWith([mockOrgList[0]]);

    // 2. User manually selects placeholder "-- Select Organization --"
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });

    // Emits empty array and records user cleared intent
    expect(mockOnSelect).toHaveBeenLastCalledWith([]);
    expect(select).toHaveValue('');
  });

  it('suppresses auto-selection when clearing a filter (broadening context)', () => {
    // Start with a single item loaded for asset-3333
    vi.mocked(useOrganizations).mockReturnValue({
      items: [mockOrgList[0]],
      isLoading: false,
      error: null,
    });

    const { rerender } = render(
      <OrganizationSelector filterOwnedId="asset-3333" onSelect={mockOnSelect} />
    );

    // 1. Narrowing context (asset selected) -> auto-selects org-001
    expect(mockOnSelect).toHaveBeenLastCalledWith([mockOrgList[0]]);

    // 2. Asset deselected -> filterOwnedId transitions to undefined (broadening context)
    rerender(<OrganizationSelector filterOwnedId={undefined} onSelect={mockOnSelect} />);

    // Manual deselection to placeholder
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });

    expect(mockOnSelect).toHaveBeenLastCalledWith([]);
    expect(select).toHaveValue('');
  });

  it('resets selection and auto-selects new valid option when active organization disappears', () => {
    // 1. Initial render with 2 items
    vi.mocked(useOrganizations).mockReturnValue({
      items: mockOrgList,
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<OrganizationSelector onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'org-001' } });
    expect(mockOnSelect).toHaveBeenLastCalledWith([mockOrgList[0]]);

    // 2. Data updates (org-001 filtered out, leaving only org-002)
    vi.mocked(useOrganizations).mockReturnValue({
      items: [mockOrgList[1]],
      isLoading: false,
      error: null,
    });

    rerender(<OrganizationSelector onSelect={mockOnSelect} />);

    // Evicts missing org-001 ([]) and then auto-selects sole remaining org-002
    expect(mockOnSelect).toHaveBeenNthCalledWith(2, []);
    expect(mockOnSelect).toHaveBeenNthCalledWith(3, [mockOrgList[1]]);
  });

  it('safely handles invalid props from Host Shell without crashing render tree', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(useOrganizations).mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
    });

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
});