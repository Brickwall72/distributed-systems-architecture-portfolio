// File: services/core/topology-service/client/src/api/client.ts
import { initClient } from '@ts-rest/core';
import { topologyContract } from 'topology-shared';

export const apiClient = initClient(topologyContract, {
  baseUrl: '/topology/api/v1',
  baseHeaders: {
    'Accept': 'application/json',
  },
  api: async (args) => {
    const response = await fetch(args.path, {
      method: args.method,
      headers: args.headers,
      body: args.body,
    });

    // 1. Handle HTTP 204 No Content (e.g. OPTIONS pre-flight) or empty bodies
    if (response.status === 204) {
      return {
        status: response.status,
        body: undefined,
        headers: response.headers,
      };
    }

    // 2. Read raw text first to avoid unhandled JSON.parse crashes on empty/malformed streams
    const text = await response.text();
    if (!text?.trim()) {
      return {
        status: response.status,
        body: undefined,
        headers: response.headers,
      };
    }

    // 3. Verify Content-Type before parsing JSON
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        status: response.status,
        body: text,
        headers: response.headers,
      };
    }

    // 4. Safely parse JSON payload
    try {
      const rawBody = JSON.parse(text);
      console.log('[DEBUG ts-rest raw response]:', {
        status: response.status,
        url: args.path,
        rawBody,
      });

      return {
        status: response.status,
        body: rawBody,
        headers: response.headers,
      };
    } catch (parseError) {
      console.error('[ts-rest] Failed to parse JSON response body:', parseError);
      return {
        status: response.status,
        body: text,
        headers: response.headers,
      };
    }
  },
});