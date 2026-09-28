// File: services/core/compliance/server/src/messaging/esign-consumer.contract.test.ts
import { MessageConsumerPact, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import { ESIGN_EVENT_TYPES } from '@contracts/esign';
import { handleDocumentSignedEvent } from './handlers';

const { uuid, string, regex } = MatchersV3;

const pact = new MessageConsumerPact({
  consumer: 'compliance-server',
  provider: 'esign-server',
  dir: path.resolve(process.cwd(), '../../../../pacts'),
});

describe('Compliance NATS Message Consumer Contract - esign-server', () => {
  it('processes valid document signed CloudEvents and records contract', async () => {
    await pact
      .given('a document has been successfully signed in esign-server')
      .expectsToReceive('a compliance document signed CloudEvent') // Must match provider verification key
      .withContent({
        specversion: '1.0',
        id: string('evt_test_1001'),
        source: string('service:esign-server'),
        type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED, // 'com.system.esign.document.signed'
        time: regex(
          '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
          '2026-09-27T12:00:00.000Z'
        ),
        datacontenttype: 'application/json',
        correlationId: string('cid_test_88192'),
        data: {
          documentId: uuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
          signerId: string('usr_4412'),
          entityId: string('clr_9910'),
          status: 'SIGNED',
        },
      })
      .verify(async (message) => {
      // Handle object, string, or Buffer types safely
      const payload = typeof message.contents === 'string'
        ? JSON.parse(message.contents)
        : Buffer.isBuffer(message.contents)
        ? JSON.parse(message.contents.toString())
        : message.contents;

      await expect(handleDocumentSignedEvent(payload)).resolves.not.toThrow();
    })
  });
});