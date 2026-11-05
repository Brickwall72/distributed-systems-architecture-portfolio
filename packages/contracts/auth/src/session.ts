// File: packages/contracts/auth/src/session.ts
import type { Identity } from './identity.schema';

/**
 * Browser-side session store shared by all federated apps. It is deliberately a plain
 * sessionStorage + window-event channel so it works across module-federation boundaries
 * without relying on a shared module instance.
 */
export interface StoredSession {
  accessToken: string;
  expiresAt: string;
  identity: Identity;
}

export const SESSION_STORAGE_KEY = 'dsap.auth.session';
export const SESSION_CHANGED_EVENT = 'dsap:auth-session-changed';

let cachedRaw: string | null | undefined;
let cachedSession: StoredSession | null = null;

/** Returns the stored session, or null when absent or expired. Referentially stable while storage is unchanged. */
export const readSession = (): StoredSession | null => {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSession = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      cachedSession = null;
    }
  }
  if (cachedSession && Date.parse(cachedSession.expiresAt) <= Date.now()) return null;
  return cachedSession;
};

export const writeSession = (session: StoredSession | null): void => {
  if (session) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

export const subscribeToSession = (onChange: () => void): (() => void) => {
  window.addEventListener(SESSION_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

/** Value for the Authorization header, or undefined when nobody is signed in. */
export const getAuthorizationHeader = (): string | undefined => {
  const session = readSession();
  return session ? `Bearer ${session.accessToken}` : undefined;
};
