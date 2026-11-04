import { initContract } from '@ts-rest/core';
import { transfersContract } from './transfers.contract';

const c = initContract();

export const auditContract = c.router({
  ...transfersContract,
});

export * from './transfers.contract';
