// File: services/core/esign/server/src/messaging/publisher.contract.verify.test.ts
import { MessageProviderPact } from '@pact-foundation/pact';
import path from 'path';
import { createDocumentSignedEvent } from './factories.js';

describe('ESign NATS Provider Contract Verification', () => {
  it('verifies generated CloudEvent payloads fulfill consumer Pact contracts', async () => {
    const pact = new MessageProviderPact({
      messageProviders: {
        // Matches the expectation description key defined in compliance-server's consumer Pact suite
        'a compliance document signed CloudEvent': () =>
          Promise.resolve(
            createDocumentSignedEvent(
              'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              'usr_4412',
              'clr_9910',
              'DD-1149',
              {
                s3Uri: 's3://compliance-documents/DD-1149/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11.pdf',
                fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              }
            )
          ),
      },
      provider: 'esign-server',
      pactUrls: [
        // Resolves consumer-generated Pact contract file stored in the workspace root pacts directory
        path.resolve(process.cwd(), '../../../../pacts/compliance-server-esign-server.json'),
      ],
    });

    await pact.verify();
  });
});