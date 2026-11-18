// File: packages/messaging/src/credentials.ts
export interface NatsCredentials {
  user: string;
  pass: string;
  inboxPrefix: string;
}

export function natsCredentialsFromEnv(env: NodeJS.ProcessEnv): NatsCredentials | undefined {
  const { NATS_USER: user, NATS_PASSWORD: pass } = env;
  if (!user && !pass) return undefined;
  if (!user || !pass || !/^[a-zA-Z0-9_-]+$/.test(user)) {
    throw new Error('NATS_USER and NATS_PASSWORD must both be provided; the user must be a valid subject token');
  }
  return { user, pass, inboxPrefix: `_INBOX.${user}` };
}
