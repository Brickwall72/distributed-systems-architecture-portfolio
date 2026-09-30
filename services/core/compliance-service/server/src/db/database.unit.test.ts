// File: services/core/compliance-service/server/src/db/database.unit.test.ts
const { mockQuery, mockSetTypeParser } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockSetTypeParser: vi.fn(),
}));

vi.mock('pg', () => ({
  default: {
    Pool: class {
      query = mockQuery;
    },
    types: {
      setTypeParser: mockSetTypeParser,
    },
  },
}));

describe('Database Configuration and Initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('registers custom type parsers for TIMESTAMP (1114) and TIMESTAMPTZ (1184) on load', async () => {
    await import('./database.js');

    expect(mockSetTypeParser).toHaveBeenCalledWith(1114, expect.any(Function));
    expect(mockSetTypeParser).toHaveBeenCalledWith(1184, expect.any(Function));
  });

  it('initDatabase successfully executes the table creation query', async () => {
    const { initDatabase } = await import('./database.js');
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(initDatabase()).resolves.toBeUndefined();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryArg = mockQuery.mock.calls[0][0];
    expect(queryArg).toContain('CREATE TABLE IF NOT EXISTS compliance_documents');
    expect(queryArg).toContain('id UUID PRIMARY KEY');
    expect(queryArg).toContain('status VARCHAR(20)');
  });

  it('initDatabase catches and rethrows errors when query execution fails', async () => {
    const { initDatabase } = await import('./database.js');
    const dbError = new Error('Connection refused');
    mockQuery.mockRejectedValueOnce(dbError);

    await expect(initDatabase()).rejects.toThrow('Connection refused');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('exports a valid pool instance', async () => {
    const { pool } = await import('./database.js');
    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });
});