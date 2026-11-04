// File: services/core/audit-ledger/server/src/utils/hash.unit.test.ts
import { canonicalJson, computeRecordHash, GENESIS_HASH } from './hash';

describe('canonicalJson', () => {
  it('serializes identically regardless of key order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [2, { y: 2, z: 1 }] }, b: 1 })
    );
  });

  it('omits undefined values but keeps null', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('preserves array order', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('computeRecordHash', () => {
  it('produces a 64-char hex digest and changes with any field', () => {
    const base = { a: 1, prevHash: GENESIS_HASH } as never;
    const hash = computeRecordHash(base);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(computeRecordHash({ a: 2, prevHash: GENESIS_HASH } as never)).not.toBe(hash);
  });
});
