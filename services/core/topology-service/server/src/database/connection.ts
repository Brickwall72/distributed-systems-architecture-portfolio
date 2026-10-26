// File: services/core/topology-service/server/src/database/connection.ts
import neo4j, { Driver } from 'neo4j-driver';
import { createLogger } from '@shared/express';

const logger = createLogger('topology-service');

const DB_URI = process.env.DB_URI || 'bolt://localhost:7687';
const DB_USER = process.env.DB_USER || 'neo4j';
const DB_PASSWORD = process.env.DB_PASSWORD || 'password';

let driverInstance: Driver | null = null;

export async function initializeDatabaseConnection(
  retries = Number.parseInt(process.env.DB_CONNECT_RETRIES || '30', 10),
  delayMs = Number.parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || '3000', 10)
): Promise<Driver> {
  logger.info(`Attempting secure connection to graph infrastructure node at URI: [${DB_URI}]`);

  const connect = async (attempt: number): Promise<Driver> => {
    try {
      driverInstance = neo4j.driver(DB_URI, neo4j.auth.basic(DB_USER, DB_PASSWORD), {
        maxConnectionPoolSize: 50,
        connectionTimeout: 5000
      });

      await driverInstance.verifyConnectivity();
      logger.info('Successfully established connection to Neo4j graph cluster node.');
      return driverInstance;
    } catch (caughtError: any) {
      logger.warn(`Database connection handshake failed (Attempt ${attempt}/${retries}): ${caughtError.message}`);

      if (driverInstance) {
        await driverInstance.close();
        driverInstance = null;
      }

      if (attempt === retries) {
        logger.error('Critical: Max graph database connection attempts exhausted. Aborting startup.');
        throw caughtError;
      }

      return new Promise<Driver>((resolve, reject) => {
        setTimeout(() => {
          connect(attempt + 1).then(resolve).catch(reject);
        }, delayMs);
      });
    }
  };

  return connect(1);
}

export function getDatabaseClient(): Driver {
  if (!driverInstance) {
    throw new Error('Database client invoked before connection initialization sequence completed.');
  }
  return driverInstance;
}

export async function terminateDatabaseClient(): Promise<void> {
  if (driverInstance) {
    logger.info('Draining active graph database connection pool sockets safely...');
    await driverInstance.close();
    driverInstance = null;
    logger.info('Database socket pool drained cleanly.');
  }
}