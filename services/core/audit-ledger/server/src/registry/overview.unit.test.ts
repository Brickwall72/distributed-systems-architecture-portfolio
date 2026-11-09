// File: services/core/audit-ledger/server/src/registry/overview.unit.test.ts
import { transferOverviewInputSchema, transferOverviewSchema } from './overview.schema';
import { renderTransferOverview } from './render-overview';
import { overviewRecord } from './overview.test-support';

describe('transfer overview', () => {
  it('projects sealed snapshots, maps receipt assets independently and escapes HTML', () => {
    const record = overviewRecord();
    const context = transferOverviewInputSchema.parse(record);
    expect(context.authorization.assets.map((asset) => asset.id)).toEqual(['asset-1', 'asset-2']);
    expect(context.receipts.map((receipt) => receipt.assets.map((asset) => asset.id))).toEqual([['asset-1'], ['asset-2']]);
    expect(context.authorization).not.toHaveProperty('fileHash');
    expect(context.authorization).not.toHaveProperty('assetIds');
    expect(context.receipts[0]).not.toHaveProperty('assetIds');
    expect(context.authorization.assets[0]).not.toHaveProperty('currentOwnerId');
    expect(context).not.toHaveProperty('eventIds');
    expect(context).not.toHaveProperty('transferEventId');
    const html = renderTransferOverview(context);
    for (const value of [record.requisitionNumber, record.authorization.documentId, record.receipts[0].documentId,
      record.receipts[1].documentId, record.completedAt, record.sealedAt, 'SN-1', 'SN-2']) {
      expect(html).toContain(value);
    }
    expect(html).toContain('&lt;Asset one&gt;');
    expect(html).not.toContain('<Asset one>');
  });

  it('validates the template-specific output schema', () => {
    const context = transferOverviewInputSchema.parse(overviewRecord());
    expect(transferOverviewSchema.parse(context)).toEqual(context);
    expect(() => transferOverviewSchema.parse({ ...context, initiatedAt: 'invalid' })).toThrow();
    expect(() => transferOverviewSchema.parse({
      ...context, authorization: { ...context.authorization, assets: [{ id: 'asset-1' }] },
    })).toThrow();
  });

  it('renders the empty receipt state and rejects missing asset snapshots', () => {
    const record = overviewRecord();
    expect(renderTransferOverview(transferOverviewInputSchema.parse({ ...record, receipts: [] }))).toContain('No receipt documents');
    expect(() => transferOverviewInputSchema.parse({
      ...record, receipts: [{ ...record.receipts[0], receivedAssets: [] }],
    })).toThrow('Missing receipt asset');
    expect(() => transferOverviewInputSchema.parse({
      ...record, authorization: { ...record.authorization, assetIds: ['missing'] },
    })).toThrow('Missing authorization asset');
  });
});
