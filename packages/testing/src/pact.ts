// File: packages/testing/src/pact.ts
import { PactV3 } from '@pact-foundation/pact';
import path from 'node:path';

interface PactConfig {
  consumer: string;
  provider: string;
  dir?: string;
}

export function createPactTestHelper(config: PactConfig) {
  const pactProvider = new PactV3({
    consumer: config.consumer,
    provider: config.provider,
    dir: config.dir || path.resolve(process.cwd(), 'pacts'),
  });

  return async function runConsumerContractTest(
    setupInteraction: (provider: PactV3) => void,
    testAction: (mockServer: { url: string }) => Promise<void>
  ) {
    setupInteraction(pactProvider);

    await pactProvider.executeTest(async (mockServer) => {
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlString = typeof input === 'string' ? input : input.toString();
        const targetUrl = urlString.startsWith('/') 
          ? `${mockServer.url}${urlString}` 
          : urlString;
          
        return originalFetch(targetUrl, init);
      };

      try {
        await testAction(mockServer);
      } finally {
        global.fetch = originalFetch;
      }
    });
  };
}