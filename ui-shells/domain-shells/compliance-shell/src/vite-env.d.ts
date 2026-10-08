// File: ui-shells/domain-shells/compliance-shell/src/vite-env.d.ts

/// <reference types="vite/client" />

declare module 'compliance_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'topology_client/AssetSelector' {
  import type { ComponentType } from 'react';
  import type { AssetSelectorProps } from '@contracts/topology';

  const AssetSelector: ComponentType<AssetSelectorProps>;
  export default AssetSelector;
}

declare module 'topology_client/OrganizationSelector' {
  import type { ComponentType } from 'react';
  import type { OrganizationSelectorProps } from '@contracts/topology';

  const OrganizationSelector: ComponentType<OrganizationSelectorProps>;
  export default OrganizationSelector;
}