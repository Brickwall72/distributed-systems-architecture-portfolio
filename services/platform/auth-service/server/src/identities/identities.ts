// File: services/platform/auth-service/server/src/identities/identities.ts
import { ROLE, type Identity } from '@contracts/auth';

/** Seeded identities: one per topology organization plus an auditor that spans all of them. */
export const IDENTITIES: readonly Identity[] = [
  { id: 'usr_jeb_junkyard', displayName: "Jeb's Junkyard Officer", orgId: 'org-jeb-junkyard', roles: [ROLE.ORG_MEMBER], signerId: 'usr_jeb_junkyard' },
  { id: 'usr_ksc_gov', displayName: 'KSC Compliance Officer', orgId: 'org-ksc-gov', roles: [ROLE.ORG_MEMBER], signerId: 'usr_ksc_gov' },
  { id: 'usr_reaction_engines', displayName: 'Reaction Engines Officer', orgId: 'org-reaction-engines', roles: [ROLE.ORG_MEMBER], signerId: 'usr_reaction_engines' },
  { id: 'usr_deepspace_network', displayName: 'Deep Space Network Officer', orgId: 'org-deepspace-network', roles: [ROLE.ORG_MEMBER], signerId: 'usr_deepspace_network' },
  { id: 'usr_auditor', displayName: 'Platform Auditor', orgId: null, roles: [ROLE.AUDITOR], signerId: 'usr_auditor' },
];

export const findIdentity = (id: string): Identity | undefined => IDENTITIES.find((i) => i.id === id);

const escapeXml = (s: string): string => s.replace(/[<>&"']/g, (c) => `&#${c.codePointAt(0)!};`);

/** Generated signature image; stands in for a stored scan of a real signature. */
export const signatureSvg = (identity: Identity): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" viewBox="0 0 320 100">` +
  `<text x="10" y="60" font-family="'Brush Script MT', cursive" font-size="36" fill="#1a237e">${escapeXml(identity.displayName)}</text>` +
  `<line x1="10" y1="75" x2="310" y2="75" stroke="#1a237e" stroke-width="1"/></svg>`;
