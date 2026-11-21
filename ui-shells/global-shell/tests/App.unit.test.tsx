// File: ui-shells/global-shell/tests/App.unit.test.tsx
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TopologyApp from '../../domain-shells/topology-shell/src/App';
import ComplianceApp from '../../domain-shells/compliance-shell/src/App';
import App from '../src/App';

vi.mock('../../domain-shells/topology-shell/src/pages', () => ({
  AssetRegistrationDashboard: () => <div>Asset registration page</div>,
  TransferHistory: () => <div>Transfer history page</div>,
}));

vi.mock('../../domain-shells/compliance-shell/src/pages', () => ({
  TransferAuthorization: () => <div>Transfer authorization page</div>,
  TransferReceipt: () => <div>Transfer receipt page</div>,
  DocumentsReview: () => <div>Documents review page</div>,
}));

vi.mock('@shared/mf-runtime', () => ({
  useFederationRegistry: () => ({ isReady: true }),
  FederatedErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  lazyRemote: (name: string) => {
    if (name === 'topology_shell/App') return () => <TopologyApp />;
    if (name === 'compliance_shell/App') return () => <ComplianceApp />;
    if (name === 'auth_client/ProfileSelector') return () => <div>Profile selector</div>;
    throw new Error(`Unexpected remote: ${name}`);
  },
}));

describe('shell routing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('uses explicit default paths and retains a selected page on reload', async () => {
    const view = render(<App />);
    expect(await screen.findByText('Asset registration page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/asset-registration');

    fireEvent.click(screen.getByRole('link', { name: 'View Transfer History' }));
    expect(await screen.findByText('Transfer history page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/transfer-history');

    view.unmount();
    render(<App />);
    expect(await screen.findByText('Transfer history page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/transfer-history');
  });

  it('restores compliance pages and supports back and forward across domains', async () => {
    window.history.replaceState(null, '', '/documents');
    const view = render(<App />);
    expect(await screen.findByText('Documents review page')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Receive Transfers' }));
    expect(await screen.findByText('Transfer receipt page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/transfer-receipts');
    view.unmount();
    render(<App />);
    expect(await screen.findByText('Transfer receipt page')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fleet' }));
    expect(await screen.findByText('Asset registration page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/asset-registration');

    await act(async () => {
      const navigated = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
      window.history.back();
      await navigated;
    });
    expect(window.location.pathname).toBe('/transfer-receipts');
    expect(await screen.findByText('Transfer receipt page')).toBeInTheDocument();

    await act(async () => {
      const navigated = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
      window.history.forward();
      await navigated;
    });
    expect(window.location.pathname).toBe('/asset-registration');
    expect(await screen.findByText('Asset registration page')).toBeInTheDocument();
  });

  it('opens the compliance default page when switching from fleet', async () => {
    render(<App />);
    expect(await screen.findByText('Asset registration page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }));
    expect(await screen.findByText('Transfer authorization page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/transfer-authorizations');
  });

  it('routes standalone shells under their deployed prefixes', async () => {
    window.history.replaceState(null, '', '/topology-shell/');
    const view = render(<TopologyApp />);
    expect(await screen.findByText('Asset registration page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/topology-shell/asset-registration');
    fireEvent.click(screen.getByRole('link', { name: 'View Transfer History' }));
    expect(await screen.findByText('Transfer history page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/topology-shell/transfer-history');

    view.unmount();
    window.history.replaceState(null, '', '/compliance-shell/');
    render(<ComplianceApp />);
    expect(await screen.findByText('Transfer authorization page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/compliance-shell/transfer-authorizations');
    fireEvent.click(screen.getByRole('link', { name: 'Receive Transfers' }));
    expect(await screen.findByText('Transfer receipt page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/compliance-shell/transfer-receipts');
  });
});
