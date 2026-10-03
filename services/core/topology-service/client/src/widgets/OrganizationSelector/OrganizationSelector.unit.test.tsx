// File: services/core/topology-service/client/src/widgets/OrganizationSelector/OrganizationSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrganizationSelector from './OrganizationSelector';
import { useOrganizations } from '../../hooks';

vi.mock('../../hooks', () => ({
  useOrganizations: vi.fn(),
}));

describe('OrganizationSelector Widget', () => {
  const mockUseOrganizations = vi.mocked(useOrganizations);
  const mockOnChange = vi.fn();

  const mockOrganizations = [
    {
      id: 'org-101',
      name: 'Cyber Operations Brigade',
      parentId: null,
    },
    {
      id: 'org-102',
      name: '1st Battalion, 1st Infantry',
      parentId: 'org-101',
    },
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes filtering params correctly to useOrganizations', () => {
    mockUseOrganizations.mockReturnValue({ items: [], isLoading: true, error: null });

    render(
      <OrganizationSelector
        label="Select Organization"
        parentId="org-101"
        onChange={mockOnChange}
      />
    );

    expect(mockUseOrganizations).toHaveBeenCalledWith({
      parentId: 'org-101',
    });
  });

  it('renders loading state when fetching organizations', () => {
    mockUseOrganizations.mockReturnValue({ items: [], isLoading: true, error: null });

    render(<OrganizationSelector label="Select Organization" onChange={mockOnChange} />);

    expect(screen.getByText('Loading organizations...')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders error state when hook returns error', () => {
    mockUseOrganizations.mockReturnValue({
      items: [],
      isLoading: false,
      error: 'Failed to load organizations',
    });

    render(<OrganizationSelector label="Select Organization" onChange={mockOnChange} />);

    expect(screen.getByText('Error: Failed to load organizations')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('maps organization items to options and triggers onChange with the full domain object on selection', async () => {
    const user = userEvent.setup();
    mockUseOrganizations.mockReturnValue({
      items: mockOrganizations,
      isLoading: false,
      error: null,
    });

    render(
      <OrganizationSelector
        label="Select Organization"
        selectedId="org-101"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Select Organization' });
    expect(select).toHaveValue('org-101');

    expect(
      screen.getByRole('option', { name: 'Cyber Operations Brigade' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: '1st Battalion, 1st Infantry' })
    ).toBeInTheDocument();

    await user.selectOptions(select, 'org-102');

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(mockOrganizations[1]);
  });

  it('calls onChange with null when selecting the default empty placeholder', () => {
    mockUseOrganizations.mockReturnValue({
      items: mockOrganizations,
      isLoading: false,
      error: null,
    });

    render(
      <OrganizationSelector
        label="Select Organization"
        selectedId="org-101"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Select Organization' });

    fireEvent.change(select, { target: { value: '' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });
});