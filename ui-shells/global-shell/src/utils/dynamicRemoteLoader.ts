// ui-shells/global-shell/src/utils/dynamicRemoteLoader.ts

import { ComponentType, lazy } from 'react';
import { RemoteDomainModule } from '@shared/shell-contracts';

const loadedScripts = new Set<string>();
// Track state externally to avoid mutating read-only ES Module objects
const initializedContainers = new Set<string>();

function loadScript(url: string): Promise<void> {
  if (loadedScripts.has(url)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.type = 'module';
    script.async = true;

    script.onload = () => {
      loadedScripts.add(url);
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Failed to load remote script: ${url}`));
    };

    document.head.appendChild(script);
  });
}

const globalScope = globalThis as typeof globalThis & {
  __webpack_share_scopes__?: { default: unknown };
};

export function importDynamicRemote(
  config: RemoteDomainModule
): React.LazyExoticComponent<ComponentType<any>> {
  return lazy(async () => {
    await loadScript(config.remoteEntry);

    let container = (window as any)[config.scope];

    if (!container) {
      try {
        container = await import(/* @vite-ignore */ config.remoteEntry);
      } catch (err) {
        throw new Error(`Remote scope [${config.scope}] could not be resolved.`);
      }
    }

    // Initialize container securely
    if (typeof container.init === 'function' && !initializedContainers.has(config.scope)) {
      const shareScope = globalScope.__webpack_share_scopes__?.default || {};
      await container.init(shareScope);
      initializedContainers.add(config.scope);
    }

    const factory = await container.get(config.module);
    return factory();
  });
}