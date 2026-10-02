// File: ui-shells/domain-shells/compliance-shell/src/vite-env.d.ts

/// <reference types="vite/client" />

declare module 'topology_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'compliance_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}