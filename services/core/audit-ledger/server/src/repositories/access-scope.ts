// File: services/core/audit-ledger/server/src/repositories/access-scope.ts
import type { AccessScope } from '@shared/express';
export { accessScopeSchema, type AccessScope } from '@shared/express';

export function participantFilter(scope: AccessScope) {
  return scope.kind === 'auditor' ? {} : {
    'sender.id': { $type: 'string', $ne: '' },
    'receiver.id': { $type: 'string', $ne: '' },
    $or: [{ 'sender.id': scope.orgId }, { 'receiver.id': scope.orgId }],
  };
}
