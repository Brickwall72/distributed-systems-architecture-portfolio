// File: services/core/topology-service/client/src/widgets/BaseSelector.unit.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaseSelector from './BaseSelector.js';

interface MockItem {
  readonly id: string;
  readonly name: string;
}

describe('BaseSelector', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders loading state initially', () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})); // Never resolves to keep loading state

    render(
      <BaseSelector<MockItem>
        label="Test Selector"
        url="/api/test"
        onChange={() => {}}
        getItemId={(item) => item.id}
        renderOptionLabel={(item) => item.name}
        loadingText="Loading items..."
        placeholderText="-- Select Item --"
      />
    );

    expect(screen.getByText('Test Selector')).toBeInTheDocument();
    expect(screen.getByText('Loading items...')).toBeInTheDocument();
  });

  it('renders options successfully after a successful fetch', async () => {
    const mockData: MockItem[] = [
      { id: 'item-1', name: 'Alpha Entity' },
      { id: 'item-2', name: 'Beta Entity' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    render(
      <BaseSelector<MockItem>
        label="Test Selector"
        url="/api/test"
        onChange={() => {}}
        getItemId={(item) => item.id}
        renderOptionLabel={(item) => item.name}
        loadingText="Loading items..."
        placeholderText="-- Select Item --"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    expect(screen.getByRole('option', { name: '-- Select Item --' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alpha Entity' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta Entity' })).toBeInTheDocument();
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(
      <BaseSelector<MockItem>
        label="Test Selector"
        url="/api/test"
        onChange={() => {}}
        getItemId={(item) => item.id}
        renderOptionLabel={(item) => item.name}
        loadingText="Loading items..."
        placeholderText="-- Select Item --"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  it('triggers onChange with the correct item when selected', async () => {
    const mockData: MockItem[] = [
      { id: 'item-1', name: 'Alpha Entity' },
      { id: 'item-2', name: 'Beta Entity' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const handleChange = vi.fn();

    render(
      <BaseSelector<MockItem>
        label="Test Selector"
        url="/api/test"
        onChange={handleChange}
        getItemId={(item) => item.id}
        renderOptionLabel={(item) => item.name}
        loadingText="Loading items..."
        placeholderText="-- Select Item --"
      />
    );

    const selectElement = await screen.findByRole('combobox');
    await userEvent.selectOptions(selectElement, 'item-2');

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(mockData[1]);
  });
});