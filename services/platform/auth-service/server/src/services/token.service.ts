// File: services/platform/auth-service/server/src/services/token.service.ts
import { SignJWT, importPKCS8 } from 'jose';
import { AUTH_AUDIENCE, AUTH_ISSUER, AUTH_JWT_ALGORITHM, type Identity } from '@contracts/auth';

export interface IssuedToken {
  accessToken: string;
  expiresAt: string;
}

export class TokenService {
  private constructor(private readonly key: CryptoKey, private readonly ttlSeconds: number) {}

  static async create(privateKeyPem: string, ttlSeconds: number): Promise<TokenService> {
    return new TokenService(await importPKCS8(privateKeyPem, AUTH_JWT_ALGORITHM), ttlSeconds);
  }

  async issue(identity: Identity): Promise<IssuedToken> {
    const exp = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const accessToken = await new SignJWT({ orgId: identity.orgId, roles: identity.roles, signerId: identity.signerId })
      .setProtectedHeader({ alg: AUTH_JWT_ALGORITHM })
      .setSubject(identity.id)
      .setIssuer(AUTH_ISSUER)
      .setAudience(AUTH_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(this.key);
    return { accessToken, expiresAt: new Date(exp * 1000).toISOString() };
  }
}
