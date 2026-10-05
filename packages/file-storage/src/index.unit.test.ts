// File: packages/file-storage/src/index.unit.test.ts
import * as PublicExports from './index';

describe('file-storage barrel exports', () => {
  it('exports ObjectStorageClient and InMemoryStorageClient from root', () => {
    expect(PublicExports.ObjectStorageClient).toBeDefined();
    expect(PublicExports.InMemoryStorageClient).toBeDefined();
    expect(typeof PublicExports.ObjectStorageClient).toBe('function');
    expect(typeof PublicExports.InMemoryStorageClient).toBe('function');
  });
});