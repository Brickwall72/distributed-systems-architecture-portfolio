// File: services/core/compliance-service/server/src/provider.contract.verify.test.ts
import { Verifier } from '@pact-foundation/pact';
import app from './server.js'; 
import { Server } from 'http';
import path from 'path';

describe('Compliance Service Provider Verification', () => {
  let server: Server;
  const PORT = 8092;

  beforeAll(() => {
    server = app.listen(PORT);
  });

  afterAll(() => {
    server.close();
  });

  it('validates the expectations of compliance-client', async () => {
    const opts = {
      providerBaseUrl: `http://localhost:${PORT}`,
      provider: 'compliance-server',
      pactUrls: [
        path.resolve(__dirname, '../../client/pacts/compliance-client-compliance-server.json')
      ],
      stateHandlers: {
        'compliance templates exist in the registry': async () => {
          console.log('Templates are ready');
        },
        'template contract-test-bare exists': async () => {
          console.log('contract-test-bare is ready');
        }
      }
    };

    const verifier = new Verifier(opts);
    await verifier.verifyProvider();
  });
});