// File: ui-shells/domain-shells/compliance-shell/src/vite-env.d.ts
// (Or create a new file named remote.d.ts in the src/ directory)

declare module 'compliance_service/Widget' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}