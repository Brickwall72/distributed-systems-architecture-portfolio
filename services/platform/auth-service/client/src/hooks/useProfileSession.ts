// File: services/platform/auth-service/client/src/hooks/useProfileSession.ts
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Identity } from '@contracts/auth';
import { readSession, subscribeToSession, writeSession } from '@contracts/auth';
import { apiClient } from '../api';

const REFRESH_MARGIN_MS = 30_000;

/**
 * Loads the selectable identities and mints/refreshes the token for the chosen one.
 * Plain hooks (no react-query) keep the widget independent of the host's query client.
 */
export function useProfileSession() {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getIdentities()
      .then((res) => {
        if (cancelled) return;
        if (res.status === 200) setIdentities(res.body);
        else setError('Unable to load profiles');
      })
      .catch(() => !cancelled && setError('Unable to load profiles'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (identityId: string) => {
    if (!identityId) {
      writeSession(null);
      return;
    }
    setError(null);
    try {
      const res = await apiClient.createSession({ body: { identityId } });
      if (res.status === 200) writeSession(res.body);
      else setError(res.status === 403 ? 'Dev login is disabled' : 'Sign-in failed');
    } catch {
      setError('Sign-in failed');
    }
  }, []);

  // Re-mint shortly before the short-lived token expires so the session keeps working.
  const identityId = session?.identity.id;
  const expiresAt = session?.expiresAt;
  useEffect(() => {
    if (!identityId || !expiresAt) return;
    const delay = Math.max(Date.parse(expiresAt) - Date.now() - REFRESH_MARGIN_MS, 0);
    const timer = setTimeout(() => void signIn(identityId), delay);
    return () => clearTimeout(timer);
  }, [identityId, expiresAt, signIn]);

  return { identities, activeIdentity: session?.identity ?? null, isLoading, error, signIn };
}
