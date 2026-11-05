// File: packages/ui/src/lib/useIdentity.ts
import { useSyncExternalStore } from 'react';
import { readSession, subscribeToSession, type Identity } from '@contracts/auth';

/** The currently signed-in identity (selected in the global-shell header), or null. */
export function useIdentity(): Identity | null {
  return useSyncExternalStore(subscribeToSession, () => readSession()?.identity ?? null, () => null);
}
