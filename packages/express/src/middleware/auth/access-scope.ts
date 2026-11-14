// File: packages/express/src/middleware/auth/access-scope.ts
import { z } from 'zod';
import type { VerifiedIdentity } from '@contracts/auth';
import { orgScope } from './auth';

export const accessScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('auditor') }),
  z.object({ kind: z.literal('organization'), orgId: z.string() }),
]);
export type AccessScope = z.infer<typeof accessScopeSchema>;

export function accessScope(identity: VerifiedIdentity | undefined): AccessScope | null {
  if (!identity) return null;
  const orgId = orgScope(identity);
  if (orgId === null) return null;
  return orgId === undefined ? { kind: 'auditor' } : { kind: 'organization', orgId };
}
