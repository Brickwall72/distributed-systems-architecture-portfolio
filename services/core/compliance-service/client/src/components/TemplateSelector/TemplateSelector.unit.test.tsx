// File: services/core/compliance-service/client/src/components/TemplateSelector/TemplateSelector.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateSelector } from './TemplateSelector';
import { useTemplatesQuery, useTemplateQuery } from '../../hooks';

// Mock the underlying template hooks
vi.mock('../../hooks', () => ({
  useTemplatesQuery: vi.fn(),
  useTemplateQuery: vi.fn(),
}));

// Mock @shared/ui-components to test interaction and prop mapping cleanly
vi.mock('@shared/ui-components', () => ({
  Select: ({ label, selectedId, options, isLoading, error, onSelection, loadingText, placeholderText }: any) => (
    <div data-testid="mock-select">
      <label>{label}</label>
      <span data-testid="loading-state">{isLoading ? loadingText : 'loaded'}</span>
      <span data-testid="error-state">{error}</span>
      <select
        data-testid="select-element"
        value={selectedId}
        onChange={(e) => onSelection(e.target.value)}
      >
        <option value="">{placeholderText}</option>
        {options.map((opt: any) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  ),
}));

describe('TemplateSelector Component', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props, fetches manifests, and auto-selects the first template', async () => {
    const mockManifests = [
      { id: 't1', name: 'Template One', type: 'AUTHORIZATION' },
      { id: 't2', name: 'Template Two', type: 'AUTHORIZATION' },
    ];
    const mockDto = { id: 't1', name: 'Template One', rawHTML: '<p>1</p>' };

    vi.mocked(useTemplatesQuery).mockReturnValue({
      data: mockManifests,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useTemplateQuery).mockReturnValue({
      data: mockDto,
      isLoading: false,
      error: null,
    } as any);

    render(<TemplateSelector onSelect={mockOnSelect} />);

    expect(screen.getByText('Template Select')).toBeDefined();
    expect(useTemplatesQuery).toHaveBeenCalledWith(undefined);
    expect(useTemplateQuery).toHaveBeenCalledWith('t1');

    // Should auto-select first template and emit upstream via useEffect
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(mockDto);
    });
  });

  it('passes typeFilter query parameter to useTemplatesQuery when specified', () => {
    vi.mocked(useTemplatesQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useTemplateQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    render(<TemplateSelector typeFilter="RECEIPT" onSelect={mockOnSelect} />);

    expect(useTemplatesQuery).toHaveBeenCalledWith({ type: 'RECEIPT' });
  });

  it('updates selectedId and triggers active template DTO fetch when user selects a different option', async () => {
    const mockManifests = [
      { id: 't1', name: 'Template One', type: 'AUTHORIZATION' },
      { id: 't2', name: 'Template Two', type: 'AUTHORIZATION' },
    ];
    const mockDto2 = { id: 't2', name: 'Template Two', rawHTML: '<p>2</p>' };

    vi.mocked(useTemplatesQuery).mockReturnValue({
      data: mockManifests,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useTemplateQuery).mockImplementation((id) => {
      return {
        data: (id as string) === 't2' ? mockDto2 : { id: 't1', name: 'Template One', rawHTML: '<p>1</p>' },
        isLoading: false,
        error: null,
      } as any;
    });

    render(<TemplateSelector onSelect={mockOnSelect} />);

    const selectEl = screen.getByTestId('select-element');
    fireEvent.change(selectEl, { target: { value: 't2' } });

    expect(useTemplateQuery).toHaveBeenCalledWith('t2');
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(mockDto2);
    });
  });
});