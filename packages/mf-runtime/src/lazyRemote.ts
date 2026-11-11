// File: packages/mf-runtime/src/lazyRemote.ts
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';

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
