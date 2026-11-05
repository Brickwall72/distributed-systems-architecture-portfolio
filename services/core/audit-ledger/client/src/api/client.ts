// File: services/core/audit-ledger/client/src/api/client.ts
import { initClient } from '@ts-rest/core';
import { getAuthorizationHeader } from '@contracts/auth';
import { auditContract } from 'audit-shared';

export const apiClient = initClient(auditContract, {
  baseUrl: '/audit/api/v1',
  baseHeaders: {
    Accept: 'application/json',
    Authorization: () => getAuthorizationHeader(),
  },
});