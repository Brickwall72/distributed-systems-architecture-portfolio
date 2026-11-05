// File: services/core/compliance-service/client/src/api/client.ts
import { initClient } from '@ts-rest/core';
import { getAuthorizationHeader } from '@contracts/auth';
import { complianceContract } from 'compliance-shared';

export const apiClient = initClient(complianceContract, {
  baseUrl: '/compliance/api/v1',
  baseHeaders: {
    Accept: 'application/json',
    // ts-rest drops undefined headers at runtime; its type just doesn't say so.
    Authorization: () => getAuthorizationHeader() as string,
  },
});