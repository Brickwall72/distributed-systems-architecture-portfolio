// File: services/core/compliance-service/client/src/widgets/TemplateSelector/TemplateSelector.unit.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TemplateSelector from './TemplateSelector';
import { useComplianceTemplates } from '../../hooks';

// 1. Mock the exact module path used by the component and import
vi.mock('../../hooks');

// 2. Mock shared UI component
vi.mock('@shared/ui-components', () => ({
  Select: ({ label, value, options, isLoading, error, onValueChange }: any) => (
    <div data-testid="shared-select">
      <label>{label}</label>
      <span data-testid="select-value">{value}</span>
      <span data-testid="select-loading">{String(isLoading)}</span>
      <span data-testid="select-error">{error ?? 'none'}</span>
      <select
        data-testid="select-dropdown"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

describe('TemplateSelector Component', () => {
  const mockUseComplianceTemplates = vi.mocked(useComplianceTemplates);
  const mockSelectTemplate = vi.fn();
  const mockOnTemplateLoad = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates configuration to hook and forwards state to Select component', () => {
    mockUseComplianceTemplates.mockReturnValue({
      options: [
        { value: 'dd-1149', label: 'DD Form 1149' },
        { value: 'da-2062', label: 'DA Form 2062' },
      ],
      isLoading: false,
      error: null,
      selectTemplate: mockSelectTemplate,
    });

    render(
      <TemplateSelector
        label="Custom Form Label"
        selectedId="dd-1149"
        onTemplateLoad={mockOnTemplateLoad}
      />
    );

    expect(mockUseComplianceTemplates).toHaveBeenCalledWith({
      selectedId: 'dd-1149',
      onTemplateLoad: mockOnTemplateLoad,
    });

    expect(screen.getByText('Custom Form Label')).toBeInTheDocument();
    expect(screen.getByTestId('select-value').textContent).toBe('dd-1149');
    expect(screen.getByTestId('select-loading').textContent).toBe('false');
  });

  it('routes user selection events to selectTemplate', () => {
    mockUseComplianceTemplates.mockReturnValue({
      options: [
        { value: 'dd-1149', label: 'DD Form 1149' },
        { value: 'da-2062', label: 'DA Form 2062' },
      ],
      isLoading: false,
      error: null,
      selectTemplate: mockSelectTemplate,
    });

    render(
      <TemplateSelector
        selectedId="dd-1149"
        onTemplateLoad={mockOnTemplateLoad}
      />
    );

    fireEvent.change(screen.getByTestId('select-dropdown'), {
      target: { value: 'da-2062' },
    });

    expect(mockSelectTemplate).toHaveBeenCalledWith('da-2062');
  });

  it('uses default fallback label when prop is omitted', () => {
    mockUseComplianceTemplates.mockReturnValue({
      options: [],
      isLoading: false,
      error: null,
      selectTemplate: mockSelectTemplate,
    });

    render(<TemplateSelector onTemplateLoad={mockOnTemplateLoad} />);

    expect(screen.getByText('Select Compliance Form')).toBeInTheDocument();
  });
});