// File: services/platform/auth-service/client/src/widgets/ProfileSelector/ProfileSelector.unit.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { identitySchema, readSession, writeSession, type Identity } from '@contracts/auth';
import { mockFromSchema } from '@shared/testing';
import ProfileSelector from './ProfileSelector';
import { apiClient } from '../../api';

vi.mock('../../api', () => ({
  apiClient: { getIdentities: vi.fn(), createSession: vi.fn() },
}));

describe('ProfileSelector', () => {
  const ksc: Identity = mockFromSchema(identitySchema, { id: 'usr_ksc_gov', displayName: 'KSC Officer', orgId: 'org-ksc-gov', roles: ['org-member'] });
  const auditor: Identity = mockFromSchema(identitySchema, { id: 'usr_auditor', displayName: 'Auditor', orgId: null, roles: ['auditor'] });

  beforeEach(() => {
    writeSession(null);
    vi.mocked(apiClient.getIdentities).mockResolvedValue({ status: 200, body: [ksc, auditor] } as never);
    vi.mocked(apiClient.createSession).mockImplementation((async ({ body }: { body: { identityId: string } }) => ({
      status: 200,
      body: {
        accessToken: 'tok',
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        identity: [ksc, auditor].find((i) => i.id === body.identityId),
      },
    })) as never);
  });

  it('lists identities and stores the minted session on selection', async () => {
    render(<ProfileSelector />);
    const select = await screen.findByRole('combobox');
    await screen.findByRole('option', { name: 'KSC Officer' });

    fireEvent.change(select, { target: { value: 'usr_ksc_gov' } });

    await waitFor(() => expect(readSession()?.identity.id).toBe('usr_ksc_gov'));
    expect(readSession()?.accessToken).toBe('tok');
  });

  it('clears the session when the selection is cleared', async () => {
    render(<ProfileSelector />);
    const select = await screen.findByRole('combobox');
    await screen.findByRole('option', { name: 'Auditor' });
    fireEvent.change(select, { target: { value: 'usr_auditor' } });
    await waitFor(() => expect(readSession()).not.toBeNull());

    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(readSession()).toBeNull());
  });

  it('shows an error when sign-in is refused', async () => {
    vi.mocked(apiClient.createSession).mockResolvedValue({ status: 403, body: { error: 'Dev login is disabled' } } as never);
    render(<ProfileSelector />);
    const select = await screen.findByRole('combobox');
    await screen.findByRole('option', { name: 'KSC Officer' });
    fireEvent.change(select, { target: { value: 'usr_ksc_gov' } });

    expect(await screen.findByText(/Dev login is disabled/)).toBeTruthy();
  });
});
