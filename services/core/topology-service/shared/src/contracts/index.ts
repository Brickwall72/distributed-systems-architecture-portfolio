// File: services/core/topology-service/shared/src/contracts/topology.contract.ts
import { initContract } from '@ts-rest/core';
import { assetsRoutes } from './assets.contract';
import { organizationsRoutes } from './organizations.contract';
import { graphRoutes } from './graph.contract';

const c = initContract();

export const topologyContract = c.router({
  ...assetsRoutes,
  ...organizationsRoutes,
  ...graphRoutes,
});

export * from './assets.contract';
export * from './organizations.contract';
export * from './graph.contract';