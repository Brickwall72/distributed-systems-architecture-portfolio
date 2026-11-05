// File: services/platform/auth-service/client/src/api/client.ts
import { initClient } from '@ts-rest/core';
import { authContract } from 'auth-shared';

export const apiClient = initClient(authContract, {
  baseUrl: '/auth/api/v1',
  baseHeaders: { Accept: 'application/json' },
});
