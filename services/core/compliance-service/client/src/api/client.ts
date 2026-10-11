// File: services/core/compliance-service/client/src/api/client.ts
import { initClient } from '@ts-rest/core';
import { complianceContract } from 'compliance-shared';

export const apiClient = initClient(complianceContract, {
  baseUrl: '/compliance/api/v1',
  baseHeaders: {
    'Accept': 'application/json',
  },
});