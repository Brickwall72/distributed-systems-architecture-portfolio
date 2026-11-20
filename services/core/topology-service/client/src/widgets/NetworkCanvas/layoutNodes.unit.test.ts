// File: services/core/topology-service/client/src/widgets/NetworkCanvas/layoutNodes.unit.test.ts
import { layoutNewNodes } from './layoutNodes';

it('spaces connected and disconnected nodes while preserving existing positions', () => {
  const existing = { source: { x: 120, y: 80 } };
  const positions = layoutNewNodes(
    ['transfer', 'receiver', 'asset', 'isolated'],
    [{ from: 'source', to: 'transfer' }, { from: 'transfer', to: 'receiver' }, { from: 'transfer', to: 'asset' }],
    existing,
  );
  expect(positions.source).toEqual(existing.source);
  expect(Math.hypot(positions.transfer.x - 120, positions.transfer.y - 80)).toBeCloseTo(350, 0);
  const all = Object.values(positions);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y)).toBeGreaterThan(250);
    }
  }
});
