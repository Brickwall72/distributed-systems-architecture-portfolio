// File: ui-shells/domain-shells/topology-shell/src/pages/TransferHistory.unit.test.tsx
import { render, screen } from '@testing-library/react';
import type { NetworkCanvasProps } from '@contracts/topology';
import TransferHistory from './TransferHistory';

const state = vi.hoisted(() => ({
  orgId: 'org-1' as string | null,
  canvasProps: undefined as NetworkCanvasProps | undefined,
}));

vi.mock('@shared/ui-components', async (importOriginal) => ({
  ...await importOriginal<typeof import('@shared/ui-components')>(),
  useIdentity: () => ({ id: 'user-1', orgId: state.orgId }),
}));

vi.mock('@shared/mf-runtime', async (importOriginal) => ({
  ...await importOriginal<typeof import('@shared/mf-runtime')>(),
  lazyRemote: (name: string) => {
    if (name !== 'topology_client/NetworkCanvas') throw new Error(`Unexpected remote: ${name}`);
    return (props: NetworkCanvasProps) => {
      state.canvasProps = props;
      return <div>Network canvas</div>;
    };
  },
}));

describe('TransferHistory', () => {
  beforeEach(() => {
    state.orgId = 'org-1';
    state.canvasProps = undefined;
  });

  it('enables asset history selection on the organization-scoped graph', () => {
    render(<TransferHistory />);
    expect(screen.getByText('Network canvas')).toBeInTheDocument();
    expect(screen.getByText(/Select assets on the graph/)).toBeInTheDocument();
    expect(state.canvasProps).toEqual({
      enableAssetHistorySelection: true,
      whitelistSenders: ['org-1'],
      whitelistReceivers: ['org-1'],
    });
  });

  it('updates organization filters when identity changes', () => {
    const { rerender } = render(<TransferHistory />);
    state.orgId = 'org-2';
    rerender(<TransferHistory />);
    expect(state.canvasProps?.whitelistSenders).toEqual(['org-2']);
    expect(state.canvasProps?.whitelistReceivers).toEqual(['org-2']);

    state.orgId = null;
    rerender(<TransferHistory />);
    expect(state.canvasProps?.whitelistSenders).toBeUndefined();
    expect(state.canvasProps?.whitelistReceivers).toBeUndefined();
  });
});
