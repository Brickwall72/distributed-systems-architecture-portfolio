import { identitySchema, ROLE } from '@contracts/auth';
import { IDENTITIES, findIdentity, signatureSvg } from './identities';

describe('identities', () => {
  it('seeds only schema-valid identities with unique ids', () => {
    IDENTITIES.forEach((i) => expect(identitySchema.safeParse(i).success).toBe(true));
    expect(new Set(IDENTITIES.map((i) => i.id)).size).toBe(IDENTITIES.length);
  });

  it('scopes org members to one org and the auditor to none', () => {
    const members = IDENTITIES.filter((i) => i.roles.includes(ROLE.ORG_MEMBER));
    expect(members.length).toBeGreaterThan(0);
    members.forEach((m) => expect(m.orgId).toEqual(expect.any(String)));
    expect(new Set(members.map((m) => m.orgId)).size).toBe(members.length);

    expect(findIdentity('usr_auditor')).toMatchObject({ orgId: null, roles: [ROLE.AUDITOR] });
  });

  describe('findIdentity', () => {
    it('returns the matching identity', () => {
      expect(findIdentity('usr_ksc_gov')?.orgId).toBe('org-ksc-gov');
    });

    it('returns undefined for an unknown id', () => {
      expect(findIdentity('nope')).toBeUndefined();
    });
  });

  describe('signatureSvg', () => {
    it('renders the display name in an SVG', () => {
      const svg = signatureSvg(findIdentity('usr_auditor')!);
      expect(svg).toMatch(/^<svg /);
      expect(svg).toContain('Platform Auditor');
    });

    it('escapes markup in the display name', () => {
      const svg = signatureSvg({ ...IDENTITIES[0], displayName: `<script>alert("x")</script> & 'y'` });
      expect(svg).not.toContain('<script>');
      expect(svg).not.toMatch(/alert\("x"\)/);
      expect(svg).toContain('&#60;script&#62;');
    });
  });
});
