// File: ui-shells/domain-shells/compliance-shell/src/vite-env.d.ts

/// <reference types="vite/client" />

declare module 'pdf_client/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'esign_client/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'topology_client/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'compliance_client/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}