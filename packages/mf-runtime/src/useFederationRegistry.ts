// File: packages/mf-runtime/src/useFederationRegistry.ts
import { useEffect, useState } from 'react';
import { registerRemotes } from '@module-federation/enhanced/runtime';

export interface UseFederationRegistryOptions {
  registryUrl?: string;
  shellName?: string;
}

export interface FederationRegistryState {
  isReady: boolean;
  error: Error | null;
}

export function useFederationRegistry({
  registryUrl = '/registry/apps.json',
  shellName = 'domain_shell',
}: UseFederationRegistryOptions = {}): FederationRegistryState {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapDomainRegistry() {
      try {
        const response = await fetch(registryUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch registry from ${registryUrl} (Status ${response.status})`);
        }
        
        const manifest = await response.json();
        if (manifest?.remotes) {
          registerRemotes(manifest.remotes);
        }
      } catch (err) {
        const runtimeError = err instanceof Error ? err : new Error(String(err));
        console.error(`[${shellName}] Failed to initialize dynamic registry:`, runtimeError);
        if (isMounted) {
          setError(runtimeError);
        }
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    bootstrapDomainRegistry();

    return () => {
      isMounted = false;
    };
  }, [registryUrl, shellName]);

  return { isReady, error };
}