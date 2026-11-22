import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../extract_boundary_calls.mjs', import.meta.url));
const root = path.resolve(`.boundary-fixture-${process.pid}`);
function write(file, text) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
}
function analyze() {
  return execFileSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
}
test('extracts proven boundaries, aliases, callers, and federation without leaking values', t => {
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(root, { recursive: true });
  execFileSync('git', ['init', '-q', root]);
  write('package.json', '{"name":"root-tooling"}');
  write('scripts/tool.js', "fetch('/root-tooling')");
  write('examples/other/package.json', '{"name":"example-only"}');
  write('examples/other/src/index.ts', "fetch('/example-only')");
  write('packages/contracts/package.json', '{"name":"@contracts/demo"}');
  write('packages/contracts/src/index.ts', "export { SUBJECTS as ALIAS } from './subjects'; export { contract } from './routes';");
  write('packages/contracts/src/subjects.ts', "export const SUBJECTS = { REQUEST: 'demo.command.go' } as const;");
  write('services/demo/client/package.json', '{"name":"demo-client"}');
  write('services/demo/client/src/api.ts', `
    import { initClient } from '@ts-rest/core';
    import { contract } from '@contracts/demo';
    export const api = initClient(contract, { baseUrl: '/demo/api' });
  `);
  write('services/demo/client/src/hook.ts', `
    import { api } from './api';
    import axios from 'axios';
    import React, { useCallback as useCb } from 'react';
    export function useThings() { return useQuery({ queryFn: () => api.list() }); }
    export function usePdf() {
      const generatePdf = useCb(async () => api.list(), []);
      const memoized = React.useMemo(() => api.list(), []);
      const named = useCb(function preservedName() { return api.list(); }, []);
      return { generatePdf, memoized, named };
    }
    function unrelated(other: any) { other.query('not a database'); other.request('x'); other.publish('x'); }
    export function unsafe() { return fetch('https://example.invalid/path?secret=do-not-output'); }
    export function send() { return axios.get('/demo/api/things'); }
  `);
  write('packages/contracts/src/routes.ts', `
    import { initContract } from '@ts-rest/core';
    const c = initContract();
    const routes = { list: c.query({ method: 'GET', path: '/things' }) };
    export const contract = c.router({ ...routes });
  `);
  write('services/demo/server/package.json', '{"name":"demo-server"}');
  write('services/demo/server/src/server.ts', `
    import type { EventBroker } from '@shared/messaging';
    import type { Driver } from 'neo4j-driver';
    import { S3Client } from '@aws-sdk/client-s3';
    import { ALIAS as SUBJECTS } from '@contracts/demo';
    const LOCAL_SUBJECTS = SUBJECTS;
    class Service {
      constructor(private broker: EventBroker) {}
      private request(subject: string) { return this.broker.request(subject, {}); }
      run() { return this.request(SUBJECTS.REQUEST); }
    }
    export function respond(broker: EventBroker) { broker.respond(SUBJECTS.REQUEST, () => {}); }
    export function subscribe(broker: EventBroker) { broker.subscribe('STREAM', 'DURABLE', () => {}, LOCAL_SUBJECTS.REQUEST); }
    export function dynamic(broker: EventBroker, subject: string) { broker.publish(subject, {}); }
    export function graph(driver: Driver) { return driver.session().executeRead(tx => tx.run('PRIVATE QUERY')); }
    export function storage(s3: S3Client) { return s3.send({}); }
  `);
  write('services/demo/client/vite.config.ts', `
    import { createRemoteConfig } from '@shared/vite-config';
    export default createRemoteConfig({ domain: 'demo', concern: 'client', exposes: {
      './Widget': './src/Widget', './Missing': './src/Missing'
    } });
  `);
  write('services/demo/client/src/Widget/index.tsx', 'export default function Widget() { return null; }');
  write('services/demo/client/src/remote.ts', `
    import { lazyRemote as remote } from '@shared/mf-runtime';
    export const Widget = remote('demo_client/Widget');
  `);
  write('services/demo/client/src/ignored.test.ts', "fetch('/should-not-be-included')");
  write('services/demo/client/tests/fixture.ts', "fetch('/test-fixture')");
  write('services/demo/client/src/__fixtures__/data.ts', "fetch('/nested-fixture')");
  execFileSync('git', ['-C', root, 'add', '.']);
  const first = analyze();
  assert.equal(first, analyze(), 'output must be deterministic');
  const result = JSON.parse(first);
  assert.equal(result.version, 1);
  assert(!first.includes('do-not-output'));
  assert(!first.includes('example.invalid'));
  assert(!result.calls.some(c => c.source.path.endsWith('ignored.test.ts')));
  assert(!result.calls.some(c => ['root-tooling', 'example-only'].includes(c.component)));
  assert(!first.includes('/root-tooling'));
  assert(!first.includes('/example-only'));
  assert(!first.includes('/test-fixture'));
  assert(!first.includes('/nested-fixture'));
  const http = result.calls.find(c => c.callee === 'api.list' && c.function.includes('useThings'));
  assert(http && http.function.includes('useThings') && http.function.includes('queryFn'));
  assert.equal(http.channel.value, '/demo/api/things');
  assert(http.contracts.includes('@contracts/demo'));
  assert(result.calls.some(c => c.callee === 'api.list' && c.function === 'usePdf > generatePdf'));
  assert(result.calls.some(c => c.callee === 'api.list' && c.function === 'usePdf > memoized'));
  assert(result.calls.some(c => c.callee === 'api.list' && c.function === 'usePdf > preservedName'));
  const responder = result.calls.find(c => c.kind === 'nats-responder');
  assert.equal(responder.channel.value, 'demo.command.go');
  assert.equal(result.calls.find(c => c.kind === 'nats-subscribe').channel.value, 'demo.command.go');
  assert.equal(result.calls.find(c => c.callee === 'axios.get').channel.value, '/demo/api/things');
  assert(result.calls.some(c => c.kind === 'database' && c.callee === 'tx.run'));
  assert(result.calls.some(c => c.kind === 'object-storage' && c.callee === 's3.send'));
  assert(!first.includes('PRIVATE QUERY'));
  const wrapper = result.calls.find(c => c.callee === 'this.broker.request');
  assert(wrapper.callers.some(c => c.function.includes('Service.run')));
  assert.equal(wrapper.role, 'boundary');
  assert(result.calls.some(c => c.kind === 'nats-request' && c.callee === 'this.request'
    && c.channel?.value === 'demo.command.go' && c.status === 'verified' && c.role === 'wrapper'));
  assert(result.calls.some(c => c.kind === 'nats-publish' && c.status === 'unresolved'));
  assert(result.gaps.some(g => g.reason.includes('Dynamic')));
  assert(!result.calls.some(c => c.callee.startsWith('other.')));
  assert.deepEqual(result.federation.exposes.map(e => [e.remote, e.module, e.implementation]), [
    ['demo_client', 'Widget', 'services/demo/client/src/Widget/index.tsx'],
  ]);
  assert(result.gaps.some(g => g.reason.includes('exposure')));
  assert(result.federation.uses.some(u => u.remote === 'demo_client' && u.module === 'Widget'));
  for (const call of result.calls) {
    assert(Array.isArray(call.contracts));
    assert(Array.isArray(call.callers));
    assert(['boundary', 'wrapper'].includes(call.role));
    assert('channel' in call && 'target' in call);
  }
  const output = path.join(root, 'result.json');
  execFileSync(process.execPath, [script, '--root', root, '--output', output]);
  assert.equal(readFileSync(output, 'utf8'), first);
});
