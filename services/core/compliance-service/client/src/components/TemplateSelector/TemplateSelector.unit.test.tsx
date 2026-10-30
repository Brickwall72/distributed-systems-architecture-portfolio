// File: services/core/compliance-service/client/src/components/TemplateSelector/TemplateSelector.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateSelector } from './TemplateSelector';
import { useTemplatesQuery, useTemplateQuery } from '../../hooks';

vi.mock('../../hooks', () => ({
  useTemplatesQuery: vi.fn(),
  useTemplateQuery: vi.fn(),
}));

vi.mock('@shared/ui-components', () => ({
  Select: ({ label, selectedId, options, isLoading, error, onSelection, loadingText, placeholderText }: any) => (
    <div data-testid="mock-select">
      <label>{label}</label>
      <span data-testid="loading-state">{isLoading ? loadingText : 'loaded'}</span>
      <span data-testid="error-state">{error}</span>
      <select data-testid="select-element" value={selectedId} onChange={(e) => onSelection(e.target.value)}>
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

const T1 = 'asset-transfer-authorization';
const T2 = 'authority-transfer-authorization';
const dto = (id: string, name: string) => ({
  id,
  name,
  type: 'AUTHORIZATION',
  transferType: 'PHYSICAL_TRANSFER',
  rawHTML: '<p>x</p>',
});
const dtos: Record<string, ReturnType<typeof dto>> = {
  [T1]: dto(T1, 'Template One'),
  [T2]: dto(T2, 'Template Two'),
};

function mockQueries(manifests: { id: string; name: string }[]) {
  vi.mocked(useTemplatesQuery).mockReturnValue({ data: manifests, isLoading: false, error: null } as any);
  vi.mocked(useTemplateQuery).mockImplementation(
    (id) => ({ data: id ? dtos[id] : null, isLoading: false, error: null }) as any
  );
}

describe('TemplateSelector Component', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not select or emit anything when multiple options exist', () => {
    mockQueries([{ id: T1, name: 'Template One' }, { id: T2, name: 'Template Two' }]);

    render(<TemplateSelector onSelect={mockOnSelect} />);

    expect(screen.getByText('Template Select')).toBeDefined();
    expect(useTemplatesQuery).toHaveBeenCalled();
    expect(useTemplateQuery).toHaveBeenLastCalledWith(undefined);
    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-state').textContent).toBe('');
  });

  it('auto-selects the only option and emits the full template with its payload schema', async () => {
    mockQueries([{ id: T1, name: 'Template One' }]);

    render(<TemplateSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({ id: T1, rawHTML: '<p>x</p>' }));
    });
    expect(mockOnSelect.mock.calls[0][0].payloadSchema).toBeDefined();
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('does not auto-select again after the user deselects', async () => {
    mockQueries([{ id: T1, name: 'Template One' }]);

    render(<TemplateSelector onSelect={mockOnSelect} />);
    await waitFor(() => expect(mockOnSelect).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId('select-element'), { target: { value: '' } });

    await waitFor(() => expect(mockOnSelect).toHaveBeenLastCalledWith(undefined));
    expect((screen.getByTestId('select-element') as HTMLSelectElement).value).toBe('');
    expect(mockOnSelect).toHaveBeenCalledTimes(2);
  });

  it('passes typeFilter query parameter to useTemplatesQuery when specified', () => {
    mockQueries([]);

    render(<TemplateSelector typeFilter="RECEIPT" onSelect={mockOnSelect} />);

    expect(useTemplatesQuery).toHaveBeenCalledWith({ type: 'RECEIPT' });
  });

  it('emits the new template only once its content has loaded', async () => {
    vi.mocked(useTemplatesQuery).mockReturnValue({
      data: [{ id: T1, name: 'Template One' }, { id: T2, name: 'Template Two' }],
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useTemplateQuery).mockReturnValue({ data: null, isLoading: true, error: null } as any);

    const { rerender } = render(<TemplateSelector onSelect={mockOnSelect} />);
    fireEvent.change(screen.getByTestId('select-element'), { target: { value: T2 } });

    expect(useTemplateQuery).toHaveBeenCalledWith(T2);
    expect(mockOnSelect).not.toHaveBeenCalled();

    vi.mocked(useTemplateQuery).mockReturnValue({ data: dtos[T2], isLoading: false, error: null } as any);
    rerender(<TemplateSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({ id: T2 }));
    });
  });

  it('keeps the dropdown usable when content fails to load', () => {
    mockQueries([{ id: T1, name: 'Template One' }, { id: T2, name: 'Template Two' }]);
    vi.mocked(useTemplateQuery).mockReturnValue({ data: null, isLoading: false, error: 'boom' } as any);

    render(<TemplateSelector onSelect={mockOnSelect} />);

    expect(screen.getByText('Error: boom')).toBeDefined();
    expect(screen.getByTestId('select-element')).toBeDefined();
  });
});
