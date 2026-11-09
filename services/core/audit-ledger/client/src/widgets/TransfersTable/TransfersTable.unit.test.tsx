// File: service/core/audit-ledger/client/src/widgets/TransfersTable/TransfersTable.unit.test.tsx
import { render as testingRender, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { transferSummarySchema, RENDITION_STATUS, LEDGER_STATUS, type TransferSummary } from 'audit-shared';
import { mockFromSchema, setTestSession } from '@shared/testing';
import TransfersTable from './TransfersTable';
import { useGetTransfers } from '../../hooks';

vi.mock('../../hooks', () => ({
  useGetTransfers: vi.fn(),
  useGetTransferPdf: vi.fn(() => ({ data: undefined, error: null })),
}));

const render = (component: ReactElement) => testingRender(
  <QueryClientProvider client={new QueryClient()}>{component}</QueryClientProvider>,
);

const mockHook = (state: { data?: TransferSummary[]; isLoading?: boolean; error?: Error | null }) =>
  vi.mocked(useGetTransfers).mockReturnValue({ data: undefined, isLoading: false, error: null, ...state } as never);

describe('TransfersTable', () => {
  const sealed = mockFromSchema(transferSummarySchema, {
    requisitionNumber: 'REQ-SEALED',
    status: LEDGER_STATUS.SEALED,
    sequence: 7,
    transferType: undefined,
    sealedAt: '2026-01-02T03:04:05.000Z',
    renditionStatus: RENDITION_STATUS.READY,
  });
  const open = mockFromSchema(transferSummarySchema, {
    requisitionNumber: 'REQ-OPEN',
    status: LEDGER_STATUS.OPEN,
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
    expect(screen.getByText(LEDGER_STATUS.SEALED)).toBeDefined();
    expect(screen.getByText(LEDGER_STATUS.OPEN)).toBeDefined();
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

  it('notifies the viewer when a sealed row is selected and deselected', () => {
    mockHook({ data: [sealed] });
    const onPdfSelect = vi.fn();
    render(<TransfersTable onPdfSelect={onPdfSelect} />);
    fireEvent.click(screen.getByText('REQ-SEALED'));
    expect(onPdfSelect).toHaveBeenCalledWith({ type: 'select', documentId: 'REQ-SEALED', identityId: 'usr_test' });
    fireEvent.click(screen.getByText('REQ-SEALED'));
    expect(onPdfSelect).toHaveBeenLastCalledWith({ type: 'clear' });
  });
});
