// File: services/core/compliance-service/server/src/messaging/esign-consumer.contract.test.ts
import { MessageConsumerPact, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import { ESIGN_EVENT_TYPES } from '@contracts/esign';
import { handleDocumentSignedEvent } from './handlers.js';
import { ComplianceDocumentRepository } from '../db/documents.repository.js';

const { uuid, string, regex } = MatchersV3;

const pact = new MessageConsumerPact({
  consumer: 'compliance-server',
  provider: 'esign-server',
  dir: path.resolve(process.cwd(), '../../../../pacts'),
});

describe('Compliance NATS Message Consumer Contract - esign-server', () => {
  it('processes valid document signed CloudEvents and records contract', async () => {
    // Mock database repository using Vitest's vi.fn()
    const mockRepository = {
      create: vi.fn<ComplianceDocumentRepository['create']>().mockResolvedValue({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        document_type: 'DD-1149',
        s3_uri: 's3://dsap/DD-1149/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11.pdf',
        status: 'Approved',
        created_at: new Date().toISOString(),
      }),
    } as unknown as ComplianceDocumentRepository;

    await pact
      .given('a document has been successfully signed in esign-server')
      .expectsToReceive('a compliance document signed CloudEvent')
      .withContent({
        specversion: '1.0',
        id: string('evt_test_1001'),
        source: string('service:esign-server'),
        type: ESIGN_EVENT_TYPES.DOCUMENT_SIGNED,
        time: regex(
          '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
          '2026-09-27T12:00:00.000Z'
        ),
        datacontenttype: 'application/json',
        correlationId: string('cid_test_88192'),
        data: {
          documentId: uuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
          documentType: string('DD-1149'),
          signerId: string('usr_4412'),
          entityId: string('clr_9910'),
          status: 'SIGNED',
          s3Uri: string('s3://dsap/DD-1149/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11.pdf'),
          fileHash: string('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
          signedAt: regex(
            '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
            '2026-09-27T12:00:00.000Z'
          ),
        },
      })
      .verify(async (message) => {
        const payload =
          typeof message.contents === 'string'
            ? JSON.parse(message.contents)
            : Buffer.isBuffer(message.contents)
            ? JSON.parse(message.contents.toString())
            : message.contents;

        // Verify handler runs without throwing Zod errors
        await expect(
          handleDocumentSignedEvent(payload, mockRepository)
        ).resolves.not.toThrow();

        // Verify repo persistence received expected transformed data
        expect(mockRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            document_type: 'DD-1149',
            status: 'Approved',
          })
        );
      });
  });
});