// File: packages/testing/src/index.ts

/**
 * Public API surface for the shared testing package.
 */
export { runStandardRouteTests } from './route-tester.js';
export { createPactTestHelper } from './pact.js';
export { mockFromSchema, SHA256_HEX } from './schema-mock.js';
