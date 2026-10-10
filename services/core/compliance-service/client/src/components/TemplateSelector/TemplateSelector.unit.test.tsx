// File: services/core/compliance-service/client/src/components/TemplateSelector/TemplateSelector.unit.test.tsx
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateSelector } from './TemplateSelector';
import { useComplianceTemplates } from '../../hooks';

vi.mock('../../hooks');

describe('TemplateSelector Component', () => {
  const mockUseComplianceTemplates = vi.mocked(useComplianceTemplates);
  const mockSelectTemplate = vi.fn();
  const mockOnTemplateLoad = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates configuration to hook and renders options in Select', () => {
    mockUseComplianceTemplates.mockReturnValue({
      options: [
        { id: 'dd-1149', name: 'DD Form 1149' },
        { id: 'da-2062', name: 'DA Form 2062' },
      ],
      isLoading: false,
      error: null,
      selectTemplate: mockSelectTemplate,
    });

    render(
      <TemplateSelector
        label="Custom Form Label"
        typeFilter="AUTHORIZATION"
        onTemplateLoad={mockOnTemplateLoad}
      />
    );

    // 1. Verify hook invocation matching current hook interface
    expect(mockUseComplianceTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: '',
        onTemplateLoad: expect.any(Function),
      })
    );

    // 2. Query initial unselected state
    expect(screen.getByLabelText('Custom Form Label')).toBeInTheDocument();
    
    const combobox = screen.getByRole('combobox', { name: 'Custom Form Label' }) as HTMLSelectElement;
    expect(combobox.value).toBe('');
    expect(screen.getByRole('option', { name: 'DD Form 1149' })).toBeInTheDocument();

    // 3. Test onTemplateLoad invocation & state sync
    const passedHookConfig = mockUseComplianceTemplates.mock.calls[0][0];
    act(() => {
      passedHookConfig.onTemplateLoad('dd-1149', '<h1>Test Template</h1>');
    });

    expect(mockOnTemplateLoad).toHaveBeenCalledWith({
      id: 'dd-1149',
      name: 'test',
      rawHTML: '<h1>Test Template</h1>',
      type: 'AUTHORIZATION',
    });

    expect(combobox.value).toBe('dd-1149');
  });

  it('routes user selection events to selectTemplate', () => {
    mockUseComplianceTemplates.mockReturnValue({
      options: [
        { id: 'dd-1149', name: 'DD Form 1149' },
        { id: 'da-2062', name: 'DA Form 2062' },
      ],
      isLoading: false,
      error: null,
      selectTemplate: mockSelectTemplate,
    });

    render(
      <TemplateSelector
        typeFilter="ALL"
        onTemplateLoad={mockOnTemplateLoad}
      />
    );

    const combobox = screen.getByRole('combobox');
    fireEvent.change(combobox, { target: { value: 'da-2062' } });

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

    expect(screen.getByLabelText('Template Select')).toBeInTheDocument();
  });
});