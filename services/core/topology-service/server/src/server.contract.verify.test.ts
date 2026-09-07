// File: services/core/topology-service/server/src/server.contract.test.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';
import { mockState } from './utils/test-setup'; // Import the global mock state controller
import app from './server';

describe('Pact Provider Verification', () => {
  let server: any;
  const port = 8082;

  beforeAll(() => {
    server = app.listen(port);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('validates expected contracts from topology-client', async () => {
    const opts = {
      provider: 'topology-server',
      providerBaseUrl: `http://localhost:${port}`,
      pactUrls: [
        path.resolve(__dirname, '../../client/pacts/topology-client-topology-server.json'),
      ],
      stateHandlers: {
        'assets exist in the topology graph': async () => {
          mockState.currentState = 'assets';
          return Promise.resolve();
        },
        'organizations exist in the topology graph': async () => {
          mockState.currentState = 'organizations';
          return Promise.resolve();
        },
        'topology entities and custody transfers exist': async () => {
          mockState.currentState = 'entities';
          return Promise.resolve();
        },
      },
    };

    await new Verifier(opts).verifyProvider();
    expect(true).toBe(true);
  });
});