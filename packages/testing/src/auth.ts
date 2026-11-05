// File: packages/testing/src/auth.ts
import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';
import {
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  AUTH_JWT_ALGORITHM,
  ROLE,
  type VerifiedIdentity,
} from '@contracts/auth';

export interface TestAuth {
  publicKeyPem: string;
  /** Mints a signed token for the given identity (defaults to an org member of `org-test`). */
  signToken: (identity?: Partial<VerifiedIdentity>, options?: { expiresIn?: string }) => Promise<string>;
  authHeader: (identity?: Partial<VerifiedIdentity>) => Promise<{ Authorization: string }>;
}

/** Creates an ephemeral key pair so tests exercise the real verification path with no shared secrets. */
export const createTestAuth = (): TestAuth => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const signToken: TestAuth['signToken'] = async (identity = {}, options = {}) => {
    const claims: VerifiedIdentity = {
      sub: 'test-user',
      orgId: 'org-test',
      roles: [ROLE.ORG_MEMBER],
      signerId: 'test-signer',
      ...identity,
    };
    const { sub, ...rest } = claims;
    return new SignJWT({ ...rest })
      .setProtectedHeader({ alg: AUTH_JWT_ALGORITHM })
      .setSubject(sub)
      .setIssuer(AUTH_ISSUER)
      .setAudience(AUTH_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(await importPKCS8(privateKey, AUTH_JWT_ALGORITHM));
  };

  return {
    publicKeyPem: publicKey,
    signToken,
    authHeader: async (identity) => ({ Authorization: `Bearer ${await signToken(identity)}` }),
  };
};
