// File: ui-shells/global-shell/src/main.tsx

import { init } from '@module-federation/enhanced/runtime';

try {
  // Fetches apps.json relative to whatever domain/port Traefik is serving
  const response = await fetch('/registry/apps.json');

  if (!response.ok) {
    throw new Error(`Failed to load system registry: ${response.statusText}`);
  }

  const manifest = await response.json();

  init({
    name: 'global_shell',
    remotes: manifest.remotes,
  });

  await import('./bootstrap');
} catch (error) {
  console.error('CRITICAL: System Registry failed to initialize.', error);
  document.body.innerHTML = `
    <div style="padding: 2rem; font-family: sans-serif; color: #721c24; background: #f8d7da;">
      <h2>System Initialization Failed</h2>
      <p>Could not load registry manifest. Check Traefik ingress routing.</p>
    </div>
  `;
}