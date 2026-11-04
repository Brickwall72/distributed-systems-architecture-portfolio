import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import DocumentsPage from './DocumentsPage';

const { loadRemote } = vi.hoisted(() => ({ loadRemote: vi.fn() }));

vi.mock('@module-federation/enhanced/runtime', () => ({ loadRemote }));

describe('DocumentsPage', () => {
  it('loads the documents and audit transfers remotes', async () => {
    loadRemote.mockImplementation(async (id: string) => ({
      default: () => <div data-testid={id} />,
    }));

    render(
      <Suspense fallback={null}>
        <DocumentsPage />
      </Suspense>,
    );

    expect(await screen.findByTestId('compliance_client/DocumentsTable')).toBeDefined();
    expect(await screen.findByTestId('audit_client/TransfersTable')).toBeDefined();
    expect(loadRemote).toHaveBeenCalledTimes(2);
  });
});
