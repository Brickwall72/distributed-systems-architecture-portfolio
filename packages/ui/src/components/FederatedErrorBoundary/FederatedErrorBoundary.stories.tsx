// File: packages/ui/src/components/SharedComponents.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import FederatedErrorBoundary from './FederatedErrorBoundary';

const meta: Meta<typeof FederatedErrorBoundary> = {
  title: 'Shared Components/FederatedErrorBoundary',
  component: FederatedErrorBoundary,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FederatedErrorBoundary>;

// ==========================================
// Error Boundary Stories
// ==========================================

export const ErrorBoundaryNormal: Story = {
  render: () => (
    <FederatedErrorBoundary remoteName="compliance_client">
      <div className="p-6 bg-emerald-950/30 border border-emerald-800/80 rounded-xl text-emerald-200 space-y-2 shadow-sm">
        <h4 className="font-semibold text-sm">Remote Widget Operational</h4>
        <p className="text-xs text-emerald-300/80">Successfully resolved widget from remote runtime registry peer.</p>
      </div>
    </FederatedErrorBoundary>
  ),
};

export const ErrorBoundaryTriggered: Story = {
  render: () => {
    const BuggyWidget = () => {
      throw new Error('Network partition: failed to fetch /topology/client/mf-manifest.json');
    };

    return (
      <FederatedErrorBoundary remoteName="topology_client">
        <BuggyWidget />
      </FederatedErrorBoundary>
    );
  },
};