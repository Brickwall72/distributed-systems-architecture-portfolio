// File: ui-shells/global-shell/src/vite-env.d.ts

/// <reference types="vite/client" />

declare module 'topology_shell/App' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'compliance_shell/App' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}
