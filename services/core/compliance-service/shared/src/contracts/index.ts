// File: services/core/compliance-service/shared/src/contracts/index.ts
import { initContract } from '@ts-rest/core';
import { templatesRoutes } from './templates.contract';
import { documentsContract } from './documents.contract';

const c = initContract();

export const complianceContract = c.router({
  ...templatesRoutes,
  ...documentsContract,
});

export * from './templates.contract';
export * from './documents.contract';