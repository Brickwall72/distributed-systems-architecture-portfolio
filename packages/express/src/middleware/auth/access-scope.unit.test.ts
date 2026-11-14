// File: packages/express/src/middleware/auth/access-scope.unit.test.ts
import { accessScope, accessScopeSchema } from './access-scope';

describe('accessScope', () => {
  it('derives auditor and organization scopes and rejects missing identity or organization', () => {
    const identity = { sub: 'user', signerId: 'user', orgId: 'org-a', roles: ['org-member'] as const };
    expect(accessScope({ ...identity, roles: [...identity.roles] })).toEqual({ kind: 'organization', orgId: 'org-a' });
    expect(accessScope({ ...identity, orgId: null, roles: ['auditor'] })).toEqual({ kind: 'auditor' });
    expect(accessScope({ ...identity, orgId: null, roles: [...identity.roles] })).toBeNull();
    expect(accessScope(undefined)).toBeNull();
  });

  it('validates the shared scope shape', () => {
    expect(accessScopeSchema.safeParse({ kind: 'organization', orgId: 'org-a' }).success).toBe(true);
    expect(accessScopeSchema.safeParse({ kind: 'organization' }).success).toBe(false);
    expect(accessScopeSchema.safeParse({ kind: 'auditor' }).success).toBe(true);
  });
});
