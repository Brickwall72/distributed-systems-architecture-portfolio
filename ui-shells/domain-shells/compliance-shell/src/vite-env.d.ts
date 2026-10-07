// File: ui-shells/domain-shells/compliance-shell/src/vite-env.d.ts

/// <reference types="vite/client" />

declare module 'topology_client/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'compliance_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'compliance_client/AssetSelector' {
  import type { ComponentType } from 'react';
  import type { AssetSelectorProps } from '@contracts/topology';

  const AssetSelector: ComponentType<AssetSelectorWidgetProps>;
  export default AssetSelector;
}