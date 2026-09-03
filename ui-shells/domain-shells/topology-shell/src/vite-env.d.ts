// File: ui-shells/domain-shells/topology-shell/src/vite-env.d.ts
// (Or create a new file named remote.d.ts in the src/ directory)

declare module 'topology_service/ConnectionFormWidget' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'topology_service/NetworkCanvasWidget' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}