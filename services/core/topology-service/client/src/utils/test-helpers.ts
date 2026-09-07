// File: services/core/topology-service/client/src/utils/test-helpers.ts
import { PactV3 } from '@pact-foundation/pact';
import path from 'node:path';

// Centralized Pact provider setup
export const pactProvider = new PactV3({
  consumer: 'topology-client',
  provider: 'topology-server',
  dir: path.resolve(process.cwd(), 'pacts'),
});

/**
 * Wraps Pact V3 test execution with automatic global.fetch mock redirection 
 * to the local Pact mock server URL.
 */
export async function runConsumerContractTest(
  setupInteraction: (provider: PactV3) => void,
  testAction: (mockServer: { url: string }) => Promise<void>
) {
  // 1. Configure the expected API interaction
  setupInteraction(pactProvider);

  // 2. Execute the test against Pact's mock server with fetch redirection
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
}