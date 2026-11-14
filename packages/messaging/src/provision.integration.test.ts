// File: packages/messaging/src/provision.integration.test.ts
import { randomUUID } from 'node:crypto';
import { connect } from '@nats-io/transport-node';
import { jetstreamManager } from '@nats-io/jetstream';
import { createCloudEventSchema } from '@contracts/common';
import { z } from 'zod';
import { EventBroker } from './index.js';

const natsUrl = process.env.SIGNING_TEST_NATS_URL;
const integration = natsUrl ? describe : describe.skip;

integration('service-owned JetStream provisioning', () => {
  it('handles concurrent setup, replays retained events and preserves durable acknowledgements', async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const stream = `INTEGRATION_${suffix}`;
    const subject = `integration.${suffix}.signed`;
    const durable = `consumer_${suffix}`;
    const first = new EventBroker(natsUrl!);
    const second = new EventBroker(natsUrl!);
    const observer = await connect({ servers: natsUrl! });
    await Promise.all([first.connect(), second.connect()]);
    try {
      await Promise.all([first.ensureStream(stream, [subject]), second.ensureStream(stream, [subject])]);
      await expect(first.ensureStream(stream, [`integration.${suffix}.other`])).rejects.toThrow('unexpected subjects');
      const event = createCloudEventSchema(z.object({ value: z.string() })).parse({
        specversion: '1.0', id: suffix, source: 'test', type: 'test', time: new Date().toISOString(),
        datacontenttype: 'application/json', correlationId: suffix, data: { value: 'ready' },
      });
      await first.publish(subject, event);
      let resolveReceived!: (payload: unknown) => void;
      const received = new Promise<unknown>((resolve) => { resolveReceived = resolve; });
      await first.subscribe(stream, durable, async (payload, ack) => { ack(); resolveReceived(payload); }, subject);
      await expect(Promise.race([
        received,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Event was not delivered')), 5000)),
      ])).resolves.toEqual(event);
      const manager = await jetstreamManager(observer);
      for (let attempt = 0; attempt < 50; attempt++) {
        if ((await manager.consumers.info(stream, durable)).ack_floor.stream_seq === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const before = await manager.consumers.info(stream, durable);
      expect(before.ack_floor.stream_seq).toBe(1);
      const competing = `competing_${suffix}`;
      await Promise.all([
        first.subscribe(stream, competing, async (_payload, ack) => ack(), subject),
        second.subscribe(stream, competing, async (_payload, ack) => ack(), subject),
      ]);
      expect((await manager.consumers.info(stream, competing)).config.filter_subject).toBe(subject);
      await first.disconnect();
      const later = { ...event, id: `${suffix}-later`, data: { value: 'while offline' } };
      await second.publish(subject, later);
      let resolveLater!: (payload: unknown) => void;
      const replayed = new Promise<unknown>((resolve) => { resolveLater = resolve; });
      await second.subscribe(stream, durable, async (payload, ack) => { ack(); resolveLater(payload); }, subject);
      await expect(Promise.race([
        replayed,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Offline event was not replayed')), 5000)),
      ])).resolves.toEqual(later);
      const after = await manager.consumers.info(stream, durable);
      expect(after.ack_floor.stream_seq).toBeGreaterThanOrEqual(1);
      await expect(second.subscribe(stream, durable, async () => {}, `integration.${suffix}.other`))
        .rejects.toThrow('unexpected configuration');
    } finally {
      await Promise.all([first.disconnect(), second.disconnect(), observer.close()]);
    }
  });

  it('waits for the publisher stream and supports cancellation', async () => {
    const broker = new EventBroker(natsUrl!);
    await broker.connect();
    try {
      const controller = new AbortController();
      const wait = broker.waitForStream(`MISSING_${randomUUID().replaceAll('-', '')}`, ['missing.>'], controller.signal);
      controller.abort(new Error('startup stopped'));
      await expect(wait).rejects.toThrow('startup stopped');
    } finally {
      await broker.disconnect();
    }
  });

  it('resumes when a publisher creates the missing stream', async () => {
    const stream = `LATE_${randomUUID().replaceAll('-', '')}`;
    const subject = `late.${randomUUID().replaceAll('-', '')}.>`;
    const subscriber = new EventBroker(natsUrl!);
    const publisher = new EventBroker(natsUrl!);
    await Promise.all([subscriber.connect(), publisher.connect()]);
    try {
      const wait = subscriber.waitForStream(stream, [subject]);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await publisher.ensureStream(stream, [subject]);
      await expect(wait).resolves.toBeUndefined();
    } finally {
      await Promise.all([subscriber.disconnect(), publisher.disconnect()]);
    }
  }, 10000);
});
