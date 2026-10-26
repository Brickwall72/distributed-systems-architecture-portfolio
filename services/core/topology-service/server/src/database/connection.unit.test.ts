// File: services/core/topology-service/server/src/database/connection.unit.test.ts
import neo4j from 'neo4j-driver';
import type { Driver } from 'neo4j-driver';
import {
  getDatabaseClient,
  initializeDatabaseConnection,
  terminateDatabaseClient,
} from './connection';

vi.mock('neo4j-driver', () => ({
  default: {
    auth: { basic: vi.fn(() => ({ credentials: 'test' })) },
    driver: vi.fn(),
  },
}));

vi.mock('@shared/express', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('topology database connection lifecycle', () => {
  beforeEach(async () => {
    await terminateDatabaseClient();
    vi.clearAllMocks();
  });

  it('initializes and returns the verified driver, then closes it on termination', async () => {
    const driver = {
      verifyConnectivity: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(neo4j.driver).mockReturnValue(driver as unknown as Driver);

    await expect(initializeDatabaseConnection(1, 0)).resolves.toBe(driver);
    expect(getDatabaseClient()).toBe(driver);
    expect(driver.verifyConnectivity).toHaveBeenCalledOnce();

    await terminateDatabaseClient();

    expect(driver.close).toHaveBeenCalledOnce();
    expect(() => getDatabaseClient()).toThrow('before connection initialization');
  });

  it('retries a failed connectivity check and closes the failed driver', async () => {
    const firstDriver = {
      verifyConnectivity: vi.fn().mockRejectedValue(new Error('temporary outage')),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const secondDriver = {
      verifyConnectivity: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(neo4j.driver)
      .mockReturnValueOnce(firstDriver as unknown as Driver)
      .mockReturnValueOnce(secondDriver as unknown as Driver);

    await expect(initializeDatabaseConnection(2, 0)).resolves.toBe(secondDriver);

    expect(firstDriver.close).toHaveBeenCalledOnce();
    expect(secondDriver.verifyConnectivity).toHaveBeenCalledOnce();
    await terminateDatabaseClient();
  });

  it('surfaces a connection failure after the configured final attempt', async () => {
    const driver = {
      verifyConnectivity: vi.fn().mockRejectedValue(new Error('database unavailable')),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(neo4j.driver).mockReturnValue(driver as unknown as Driver);

    await expect(initializeDatabaseConnection(1, 0)).rejects.toThrow('database unavailable');
    expect(driver.close).toHaveBeenCalledOnce();
    expect(() => getDatabaseClient()).toThrow('before connection initialization');
  });
});
