// File: services/core/compliance-service/shared/src/contracts/index.ts
import { initContract } from '@ts-rest/core';
import { templatesRoutes } from './templates.contract';

const c = initContract();

export const complianceContract = c.router({
  ...templatesRoutes,
});

export * from './templates.contract';