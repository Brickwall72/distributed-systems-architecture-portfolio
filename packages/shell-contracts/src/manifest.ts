// File: packages/shell-contracts/src/manifest.ts

export interface RemoteDomainModule {
  /** Unique domain key (e.g., 'topology') */
  domainId: string;
  /** Label displayed in the shell navigation header */
  navLabel: string;
  /** Route path for React Router (e.g., '/topology') */
  path: string;
  /** Complete URL to the federated remote entry point */
  remoteEntry: string;
  /** Global scope name declared in remote's federation config */
  scope: string;
  /** Module exposed by the remote (e.g., './App') */
  module: string;
}

export interface ShellManifest {
  version: string;
  remotes: RemoteDomainModule[];
}