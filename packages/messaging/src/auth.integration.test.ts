// File: packages/messaging/src/auth.integration.test.ts
import { connect } from '@nats-io/transport-node';
import { jetstreamManager } from '@nats-io/jetstream';
import { createCloudEventSchema } from '@contracts/common';
import { z } from 'zod';
import { EventBroker } from './index.js';

const natsUrl = process.env.AUTH_TEST_NATS_URL;
const integration = natsUrl ? describe : describe.skip;
const credentials = (user: string) => ({ user, pass: `test-${user}`, inboxPrefix: `_INBOX.${user}` });
const auditCompliance = ['initiated', 'received'].map((kind) => ({
  name: `audit-ledger-transfer-${kind}-consumer`, filterSubject: `events.compliance.transfer.${kind}`,
}));
const topologyConsumers = ['created', 'updated', 'completed'].flatMap((kind) => [
  { name: `compliance-service-transfer-event-${kind}-consumer`, filterSubject: `events.topology.transfer.${kind}` },
  { name: `audit-ledger-transfer-${kind}-consumer`, filterSubject: `events.topology.transfer.${kind}` },
]);

integration('authenticated NATS permissions', () => {
  it('permits the intended flow while blocking anonymous access, forged replies and JetStream administration', async () => {
    await expect(connect({ servers: natsUrl!, maxReconnectAttempts: 0, timeout: 1000 })).rejects.toThrow();
    await expect(connect({ servers: natsUrl!, user: 'compliance', pass: 'incorrect', maxReconnectAttempts: 0, timeout: 1000 })).rejects.toThrow();
    const compliance = new EventBroker(natsUrl!, undefined, credentials('compliance'));
    const topology = new EventBroker(natsUrl!, undefined, credentials('topology'));
    const esign = new EventBroker(natsUrl!, undefined, credentials('esign'));
    const pdf = new EventBroker(natsUrl!, undefined, credentials('pdf'));
    const audit = new EventBroker(natsUrl!, undefined, credentials('audit'));
    const services = [compliance, topology, esign, pdf, audit];
    const rawTopology = await connect({ servers: natsUrl!, ...credentials('topology') });
    const rawAudit = await connect({ servers: natsUrl!, ...credentials('audit') });
    try {
      await Promise.all(services.map((service) => service.connect()));
      await Promise.all([
        compliance.ensureStream('COMPLIANCE_EVENTS', ['events.compliance.>']),
        topology.ensureStream('TOPOLOGY_EVENTS', ['events.topology.>']),
      ]);
      topology.respond('requests.topology.transfer.reserve', async () => ({ status: 'OK' }));
      esign.respond('esign.command.sign-document', async () => ({ status: 'SIGNED' }));
      pdf.respond('pdf.command.generate-draft', async () => ({ status: 'GENERATED' }));
      await Promise.all([topology.flush(), esign.flush(), pdf.flush()]);
      expect(await compliance.request('requests.topology.transfer.reserve', {})).toEqual({ status: 'OK' });
      expect(await compliance.request('esign.command.sign-document', {})).toEqual({ status: 'SIGNED' });
      expect(await compliance.request('pdf.command.generate-draft', {})).toEqual({ status: 'GENERATED' });
      expect(await audit.request('pdf.command.generate-draft', {})).toEqual({ status: 'GENERATED' });

      let resolveReceived!: (payload: unknown) => void;
      const received = new Promise<unknown>((resolve) => { resolveReceived = resolve; });
      await topology.subscribe('COMPLIANCE_EVENTS', 'topology-service-signed-transfer-v1', async (payload, ack) => {
        ack();
        resolveReceived(payload);
      }, 'events.compliance.transfer.signed');
      const event = createCloudEventSchema(z.object({ value: z.string() })).parse({
        specversion: '1.0', id: 'auth-test', source: 'test', type: 'test', time: new Date().toISOString(),
        datacontenttype: 'application/json', correlationId: 'auth-test', data: { value: 'ready' },
      });
      await compliance.publish('events.compliance.transfer.signed', event);
      await expect(Promise.race([
        received,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Event was not delivered')), 5000)),
      ])).resolves.toEqual(event);

      const deliveries = [...auditCompliance.map((consumer) => ({ ...consumer, service: audit, stream: 'COMPLIANCE_EVENTS' })),
        ...topologyConsumers.map((consumer) => ({
          ...consumer, service: consumer.name.startsWith('audit-') ? audit : compliance, stream: 'TOPOLOGY_EVENTS',
        }))];
      const receivedByConsumers = deliveries.map(async ({ name, filterSubject, service, stream }) => {
        let resolve!: (payload: unknown) => void;
        const delivery = new Promise<unknown>((done) => { resolve = done; });
        await service.subscribe(stream, name, async (payload, ack) => { ack(); resolve(payload); }, filterSubject);
        return { delivery };
      });
      const waiting = await Promise.all(receivedByConsumers);
      for (const { filterSubject } of auditCompliance) await compliance.publish(filterSubject, event);
      for (const kind of ['created', 'updated', 'completed']) {
        await topology.publish(`events.topology.transfer.${kind}`, event);
      }
      await expect(Promise.race([
        Promise.all(waiting.map(({ delivery }) => delivery)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Consumer delivery timed out')), 5000)),
      ])).resolves.toEqual(deliveries.map(() => event));

      await expect(rawTopology.request('events.compliance.transfer.signed', new Uint8Array(), { timeout: 1000 }))
        .rejects.toThrow(/permission/i);
      await expect(rawTopology.request('_INBOX.compliance.forged', new Uint8Array(), { timeout: 1000 }))
        .rejects.toThrow(/permission/i);
      const manager = await jetstreamManager(rawTopology);
      await expect(manager.streams.delete('COMPLIANCE_EVENTS')).rejects.toThrow(/permission/i);
      await expect(manager.streams.add({ name: 'UNAUTHORIZED', subjects: ['events.unauthorized.>'] }))
        .rejects.toThrow(/permission/i);
      await expect(manager.consumers.add('TOPOLOGY_EVENTS', {
        durable_name: 'audit-ledger-transfer-created-consumer',
        filter_subject: 'events.topology.transfer.created',
      })).rejects.toThrow(/permission/i);
      await expect(manager.consumers.add('COMPLIANCE_EVENTS', {
        durable_name: 'topology-service-signed-transfer-v1',
        filter_subject: 'events.compliance.transfer.received',
      })).rejects.toThrow(/permission/i);
      await expect(manager.consumers.delete('COMPLIANCE_EVENTS', 'topology-service-signed-transfer-v1'))
        .rejects.toThrow(/permission/i);
      const auditManager = await jetstreamManager(rawAudit);
      await expect(auditManager.consumers.info('TOPOLOGY_EVENTS', 'compliance-service-transfer-event-created-consumer'))
        .rejects.toThrow(/permission/i);
      await expect(rawAudit.request('events.topology.transfer.created', new Uint8Array(), { timeout: 1000 }))
        .rejects.toThrow(/permission/i);
    } finally {
      await Promise.all([rawTopology.close(), rawAudit.close()]);
      await Promise.all(services.map((service) => service.disconnect()));
    }
  }, 15000);
});
