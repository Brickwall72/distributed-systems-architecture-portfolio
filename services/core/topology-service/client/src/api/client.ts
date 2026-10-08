// File: services/core/topology-service/client/src/api/client.ts
import { initClient } from '@ts-rest/core';
import { topologyContract } from 'topology-shared';

export const apiClient = initClient(topologyContract, {
  baseUrl: '/topology/api/v1',
  baseHeaders: {
    'Accept': 'application/json',
  },
});