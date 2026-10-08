// ui-shells/domain-shells/compliance-shell/src/utils/federation.ts
import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';

/**
 * Clean, type-safe, SonarQube-compliant remote loader wrapper for Module Federation.
 */
export function lazyRemote<P = {}>(
  remoteModule: string
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    const mod = await loadRemote<{ default: ComponentType<P> }>(remoteModule);
    if (!mod?.default) {
      throw new Error(`[Module Federation] Failed to resolve default export for remote module: ${remoteModule}`);
    }
    return mod;
  });
}