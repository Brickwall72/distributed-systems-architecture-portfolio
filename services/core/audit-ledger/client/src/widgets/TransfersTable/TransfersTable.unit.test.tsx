import { render, screen, fireEvent } from '@testing-library/react';
import { transferSummarySchema, type TransferSummary } from 'audit-shared';
import { mockFromSchema, setTestSession } from '@shared/testing';
import TransfersTable from './TransfersTable';
import { useGetTransfers } from '../../hooks';

vi.mock('../../hooks', () => ({
  useGetTransfers: vi.fn(),
}));

const mockHook = (state: { data?: TransferSummary[]; isLoading?: boolean; error?: Error | null }) =>
  vi.mocked(useGetTransfers).mockReturnValue({ data: undefined, isLoading: false, error: null, ...state } as never);

describe('TransfersTable', () => {
  const sealed = mockFromSchema(transferSummarySchema, {
    requisitionNumber: 'REQ-SEALED',
    status: 'SEALED',
    sequence: 7,
    transferType: undefined,
    sealedAt: '2026-01-02T03:04:05.000Z',
  });
  const open = mockFromSchema(transferSummarySchema, {
    requisitionNumber: 'REQ-OPEN',
    status: 'OPEN',
    sequence: undefined,
    transferType: undefined,
    sealedAt: undefined,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setTestSession();
  });

  it('prompts for a profile instead of reporting an error when signed out', () => {
    setTestSession(null);
    mockHook({});
    render(<TransfersTable />);
    expect(screen.getByText('Select a profile to view audit ledger transfers.')).toBeDefined();
  });

  it('shows a loading message while fetching', () => {
    mockHook({ isLoading: true });
    render(<TransfersTable />);

    expect(screen.getByText('Loading audit ledger transfers...')).toBeDefined();
  });

  it.each([
    ['an error', { error: new Error('boom') }],
    ['no data', {}],
  ])('shows a failure message for %s', (_label, state) => {
    mockHook(state);
    render(<TransfersTable />);

    expect(screen.getByText('Failed to load transfer ledger data.')).toBeDefined();
  });

  it('renders each transfer with its status, sequence and record count', () => {
    mockHook({ data: [sealed, open] });
    render(<TransfersTable />);

    expect(screen.getByText('Showing 2 records')).toBeDefined();
    expect(screen.getByText('REQ-SEALED')).toBeDefined();
    expect(screen.getByText('REQ-OPEN')).toBeDefined();
    expect(screen.getByText('SEALED')).toBeDefined();
    expect(screen.getByText('OPEN')).toBeDefined();
    expect(screen.getByText('#7')).toBeDefined();
  });

  it('only allows sealed transfers to be selected', () => {
    mockHook({ data: [sealed, open] });
    render(<TransfersTable />);
    const [, sealedRow, openRow] = screen.getAllByRole('row');

    expect(sealedRow).toHaveAttribute('tabindex', '0');
    expect(openRow).not.toHaveAttribute('tabindex');

    fireEvent.click(screen.getByText('REQ-OPEN'));
    expect(sealedRow).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByText('REQ-SEALED'));
    expect(sealedRow).toHaveAttribute('aria-selected', 'true');
  });
});
