// File: services/platform/esignature-service/server/src/config/config.unit.test.ts
import { envSchema } from './config';

describe('Environment Configuration Schema', () => {
  it('passes validation with valid S3 credentials', () => {
    const validConfig = {
      S3_ACCESS_KEY: 'valid-access-key',
      S3_SECRET_KEY: 'valid-secret-key',
    };

    const result = envSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('fails validation when S3 credentials are empty', () => {
    const invalidConfig = {
      S3_ACCESS_KEY: '',
      S3_SECRET_KEY: '',
    };

    const result = envSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);

    if (!result.success) {
      const issueKeys = result.error.issues.map((i) => i.path[0]);
      expect(issueKeys).toContain('S3_ACCESS_KEY');
      expect(issueKeys).toContain('S3_SECRET_KEY');
    }
  });
});