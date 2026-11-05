# auth-service

Minimal dev-login identity service.

- **Server** mints short-lived (15 min) RS256 JWTs for a fixed set of seeded identities (one per organization plus an `auditor`) via `POST /api/v1/session`. The private key never leaves this service.
- **Client** exposes the `ProfileSelector` federated widget (`auth_client/ProfileSelector`), mounted in the global-shell header. The token is kept in `sessionStorage` and read by every API client and `useIdentity()` from `@shared/ui-components`.
- **Verification** happens locally in compliance, topology and audit servers through `createVerifyJwt` from `@shared/express`, using only the public key (`AUTH_PUBLIC_KEY_FILE`). Algorithm, issuer, audience and expiry are enforced; no call to the auth service is made.

## Running locally

```sh
scripts/generate-auth-keys.sh        # writes .auth-keys/{private,public}.pem (gitignored)
AUTH_DEV_LOGIN=true docker compose up
```

`scripts/k8s-local-secrets.sh` creates the `auth-signing-key` (private, auth-server only) and `auth-public-key` (verifying servers) secrets.

## Dev login is the seam for a real IdP

`AUTH_DEV_LOGIN` defaults to `false` and logs a loud warning when enabled, because anyone who can reach `/session` can act as any seeded identity. Replacing `POST /session` with an OIDC flow (and publishing a JWKS instead of a static public key) is the only change needed for real authentication; the token claims and the verification middleware stay the same.

## Not yet enforced

Authentication is required on all non-health routes, and the compliance server takes `signerId` from the token. Per-organization data scoping on the server (using `orgScope` / `requireOrgAccess`) is still to be applied to the topology, compliance and audit queries.
