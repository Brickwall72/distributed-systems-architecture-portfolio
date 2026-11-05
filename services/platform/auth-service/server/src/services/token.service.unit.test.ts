import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { jwtVerify, importSPKI, decodeProtectedHeader } from 'jose';
import { AUTH_AUDIENCE, AUTH_ISSUER, AUTH_JWT_ALGORITHM, tokenClaimsSchema } from '@contracts/auth';
import { TokenService } from './token.service';
import { findIdentity } from '../identities/identities';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();

describe('TokenService', () => {
  const identity = findIdentity('usr_ksc_gov')!;

  it('issues a signed token carrying the identity claims', async () => {
    const service = await TokenService.create(privateKey, 900);
    const { accessToken } = await service.issue(identity);

    const { payload, protectedHeader } = await jwtVerify(accessToken, await importSPKI(publicKeyPem, AUTH_JWT_ALGORITHM), {
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    });
    expect(protectedHeader.alg).toBe(AUTH_JWT_ALGORITHM);
    expect(payload).toMatchObject({ sub: identity.id, orgId: identity.orgId, roles: identity.roles, signerId: identity.signerId });
    expect(tokenClaimsSchema.safeParse(payload).success).toBe(true);
  });

  it('sets expiry from the configured TTL and reports it as expiresAt', async () => {
    const service = await TokenService.create(privateKey, 60);
    const before = Math.floor(Date.now() / 1000);
    const { accessToken, expiresAt } = await service.issue(identity);

    const { payload } = await jwtVerify(accessToken, await importSPKI(publicKeyPem, AUTH_JWT_ALGORITHM));
    expect(payload.exp).toBeGreaterThanOrEqual(before + 60);
    expect(payload.exp).toBeLessThanOrEqual(before + 61);
    expect(new Date(expiresAt).getTime()).toBe(payload.exp! * 1000);
  });

  it('carries a null orgId for cross-org identities', async () => {
    const service = await TokenService.create(privateKey, 900);
    const { accessToken } = await service.issue(findIdentity('usr_auditor')!);
    const { payload } = await jwtVerify(accessToken, await importSPKI(publicKeyPem, AUTH_JWT_ALGORITHM));
    expect(payload.orgId).toBeNull();
  });

  it('rejects a key that is not a valid PKCS8 private key', async () => {
    await expect(TokenService.create('not a key', 900)).rejects.toThrow();
  });

  it('pins the signing algorithm in the header', async () => {
    const { accessToken } = await (await TokenService.create(privateKey, 900)).issue(identity);
    expect(decodeProtectedHeader(accessToken).alg).toBe(AUTH_JWT_ALGORITHM);
  });
});
