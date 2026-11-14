// File: ui-shells/domain-shells/topology-shell/src/pages/AssetRegistrationDashboard.tsx
import { Suspense, useState } from 'react';
import { FederatedErrorBoundary, lazyRemote } from '@shared/mf-runtime';
import { useIdentity } from '@shared/ui-components';
import type { AssetRegistrationProps, NetworkCanvasProps, OrganizationSelectorProps } from '@contracts/topology';
import '@shared/styles';

// Dynamically resolve autonomous widgets at runtime (now backed by populated registerRemotes)
const AssetRegistration = lazyRemote<AssetRegistrationProps>('topology_client/AssetRegistration');
const NetworkCanvas = lazyRemote<NetworkCanvasProps>('topology_client/NetworkCanvas');
const OrganizationSelector = lazyRemote<OrganizationSelectorProps>('topology_client/OrganizationSelector');

export default function AssetRegistrationDashboard() {
  const identity = useIdentity();
  return <AssetRegistrationSession key={JSON.stringify([identity?.id, identity?.orgId, identity?.roles])} identity={identity} />;
}

function AssetRegistrationSession({ identity }: { readonly identity: ReturnType<typeof useIdentity> }) {
  const [organizationId, setOrganizationId] = useState('');

  return (
    <div className="p-6 font-sans max-w-7xl mx-auto">
      <header className="mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Mission Control: Fleet Topology Graph</h1>
        <p className="text-sm text-slate-400 mt-1">Manage physical asset deployments and verify connectivity paths across the cluster mesh.</p>
      </header>

      {/* Layout engine assembling federated client widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FederatedErrorBoundary remoteName="topology_client/AssetRegistration">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Connection Form...
            </div>
          }>
            <AssetRegistration organizationId={organizationId}>
              <FederatedErrorBoundary remoteName="topology_client/OrganizationSelector">
                <Suspense fallback={<div className="text-slate-500 font-mono animate-pulse">Loading organization selector...</div>}>
                  <OrganizationSelector
                    label="Holding Organization Custody"
                    onSelect={(organization) => setOrganizationId(organization?.id ?? '')}
                    onlyOrgId={identity?.orgId ?? undefined}
                  />
                </Suspense>
              </FederatedErrorBoundary>
            </AssetRegistration>
          </Suspense>
        </FederatedErrorBoundary>

        <FederatedErrorBoundary remoteName="topology_client/NetworkCanvas">
          <Suspense fallback={
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse text-slate-500 font-mono text-xs">
              Loading Network Canvas...
            </div>
          }>
            <NetworkCanvas 
              whitelistSenders={[organizationId]}
              whitelistReceivers={[organizationId]}
            />
          </Suspense>
        </FederatedErrorBoundary>
      </div>
    </div>
  );
}