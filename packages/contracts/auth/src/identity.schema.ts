// File: packages/contracts/auth/src/identity.schema.ts
import { z } from 'zod';

export const AUTH_ISSUER = 'dsap-auth-service';
export const AUTH_AUDIENCE = 'dsap-platform';
export const AUTH_JWT_ALGORITHM = 'RS256';

/** `auditor` sees every organization; `org-member` is scoped to its own organization. */
export const ROLE = {
  ORG_MEMBER: 'org-member',
  AUDITOR: 'auditor',
} as const;
export const roleEnum = z.enum([ROLE.ORG_MEMBER, ROLE.AUDITOR]);
export type Role = z.infer<typeof roleEnum>;

/** The public profile of a seeded identity (never includes signature material). */
export const identitySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  /** Organization the identity acts for; `null` for identities that span organizations (auditor). */
  orgId: z.string().min(1).nullable(),
  roles: z.array(roleEnum).min(1),
  /** Recorded as the signer on signed documents. */
  signerId: z.string().min(1),
});
export type Identity = z.infer<typeof identitySchema>;

/** Claims carried by the signed access token; `sub` is the identity id. */
export const tokenClaimsSchema = z.object({
  sub: z.string().min(1),
  orgId: identitySchema.shape.orgId,
  roles: identitySchema.shape.roles,
  signerId: identitySchema.shape.signerId,
  iss: z.literal(AUTH_ISSUER),
  aud: z.union([z.literal(AUTH_AUDIENCE), z.array(z.string()).refine((a) => a.includes(AUTH_AUDIENCE))]),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type TokenClaims = z.infer<typeof tokenClaimsSchema>;

/** What the verifying middleware attaches to the request once the token is trusted. */
export type VerifiedIdentity = Pick<TokenClaims, 'sub' | 'orgId' | 'roles' | 'signerId'>;

export const isAuditor = (identity: Pick<VerifiedIdentity, 'roles'>): boolean => identity.roles.includes(ROLE.AUDITOR);

/** Whether the identity may see data belonging to `orgId`. */
export const canAccessOrg = (identity: VerifiedIdentity, orgId: string): boolean =>
  isAuditor(identity) || identity.orgId === orgId;
