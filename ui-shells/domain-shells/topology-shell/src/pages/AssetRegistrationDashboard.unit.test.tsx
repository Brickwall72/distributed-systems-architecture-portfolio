// File: ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.unit.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { AssetRegistrationProps, SingleOrganizationSelectorProps } from '@contracts/topology';
import AssetRegistrationDashboard from './AssetRegistrationDashboard';

const remoteState = vi.hoisted(() => ({
  registration: 'ready',
  selector: 'ready',
  pending: new Promise(() => {}),
}));

vi.mock('@shared/mf-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/mf-runtime')>();

  return {
    ...actual,
    lazyRemote: (name: string) => {
      if (name === 'topology_client/AssetRegistration') {
        return ({ organizationId, children }: AssetRegistrationProps) => {
          if (remoteState.registration === 'loading') throw remoteState.pending;
          if (remoteState.registration === 'error') throw new Error('Registration unavailable');
          return (
            <section aria-label="Asset registration">
              <output data-testid="organization-id">{organizationId}</output>
              {children}
            </section>
          );
        };
      }
      if (name === 'topology_client/OrganizationSelector') {
        return ({ label, onSelect }: SingleOrganizationSelectorProps) => {
          if (remoteState.selector === 'loading') throw remoteState.pending;
          if (remoteState.selector === 'error') throw new Error('Selector unavailable');
          return (
            <div>
              <span>{label}</span>
              <button type="button" onClick={() => onSelect({ id: 'org-jeb-junkyard', name: 'First Organization', type: 'CONTRACTOR' })}>
                Select first organization
              </button>
              <button type="button" onClick={() => onSelect({ id: 'org-ksc-gov', name: 'Second Organization', type: 'GOV_AGENCY' })}>
                Select second organization
              </button>
              <button type="button" onClick={() => onSelect(undefined)}>Clear organization</button>
            </div>
          );
        };
      }
      if (name === 'topology_client/NetworkCanvas') {
        return () => <div>Network canvas</div>;
      }
      throw new Error(`Unexpected remote: ${name}`);
    },
  };
});

describe('AssetRegistrationDashboard composition', () => {
  beforeEach(() => {
    remoteState.registration = 'ready';
    remoteState.selector = 'ready';
  });

  it('passes selected and cleared organization IDs to registration and embeds the selector', () => {
    render(<AssetRegistrationDashboard />);

    const registration = screen.getByRole('region', { name: 'Asset registration' });
    expect(registration).toContainElement(screen.getByText('Holding Organization Custody'));
    expect(screen.getByTestId('organization-id')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', { name: 'Select first organization' }));
    expect(screen.getByTestId('organization-id')).toHaveTextContent('org-jeb-junkyard');

    fireEvent.click(screen.getByRole('button', { name: 'Select second organization' }));
    expect(screen.getByTestId('organization-id')).toHaveTextContent('org-ksc-gov');

    fireEvent.click(screen.getByRole('button', { name: 'Clear organization' }));
    expect(screen.getByTestId('organization-id')).toBeEmptyDOMElement();
  });

  it('shows the selector loading state inside registration', () => {
    remoteState.selector = 'loading';
    render(<AssetRegistrationDashboard />);

    expect(screen.getByRole('region', { name: 'Asset registration' }))
      .toContainElement(screen.getByText('Loading organization selector...'));
    expect(screen.getByTestId('organization-id')).toBeEmptyDOMElement();
    expect(screen.getByText('Network canvas')).toBeInTheDocument();
  });

  it('isolates selector errors inside registration', () => {
    remoteState.selector = 'error';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<AssetRegistrationDashboard />);

      expect(screen.getByRole('region', { name: 'Asset registration' }))
        .toContainElement(screen.getByText('Selector unavailable'));
      expect(screen.getByText('topology_client/OrganizationSelector')).toBeInTheDocument();
      expect(screen.getByTestId('organization-id')).toBeEmptyDOMElement();
      expect(screen.getByText('Network canvas')).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('isolates registration loading and errors from the network canvas', () => {
    remoteState.registration = 'loading';
    const { unmount } = render(<AssetRegistrationDashboard />);
    expect(screen.getByText('Loading Connection Form...')).toBeInTheDocument();
    expect(screen.getByText('Network canvas')).toBeInTheDocument();
    unmount();

    remoteState.registration = 'error';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<AssetRegistrationDashboard />);
      expect(screen.getByText('Registration unavailable')).toBeInTheDocument();
      expect(screen.getByText('topology_client/AssetRegistration')).toBeInTheDocument();
      expect(screen.getByText('Network canvas')).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
