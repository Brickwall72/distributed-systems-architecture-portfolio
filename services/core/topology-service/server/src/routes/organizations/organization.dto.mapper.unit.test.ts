// File: services/core/topology-service/server/src/routes/organizations/organization.dto.mapper.unit.test.ts
import { OrganizationDTOSchema } from '@contracts/topology';
import { organizationEntityToDTO } from './organization.dto.mapper';
import { OrganizationEntity } from '../../domain';

describe('organizationEntityToDTO', () => {
  it('maps a complete domain entity into a contract-valid OrganizationDTO', () => {
    const entity: OrganizationEntity = {
      id: 'org-101',
      name: 'US Space Force',
      type: 'MILITARY_BRANCH',
      addressLine1: 'Pentagon Rm 4C1000',
      addressLine2: 'Washington, DC',
    };

    const dto = organizationEntityToDTO(entity);

    // 1. Assert field mapping correctness
    expect(dto).toEqual({
      id: 'org-101',
      name: 'US Space Force',
      type: 'MILITARY_BRANCH',
      addressLine1: 'Pentagon Rm 4C1000',
      addressLine2: 'Washington, DC',
    });

    // 2. DevSecOps Boundary Check: Explicitly validate mapped DTO against the Zod schema
    expect(() => OrganizationDTOSchema.parse(dto)).not.toThrow();
  });

  it('preserves optional address fields as undefined when omitted', () => {
    const entity: OrganizationEntity = {
      id: 'org-202',
      name: 'Cyber Command',
      type: 'GOV',
    };

    const dto = organizationEntityToDTO(entity);

    expect(dto).toEqual({
      id: 'org-202',
      name: 'Cyber Command',
      type: 'GOV',
      addressLine1: undefined,
      addressLine2: undefined,
    });

    // Verify contract compliance with missing optional fields
    expect(() => OrganizationDTOSchema.parse(dto)).not.toThrow();
  });

  it('throws a domain validation error when organization type is invalid', () => {
    const entity: OrganizationEntity = {
      id: 'org-303',
      name: 'Acme Corp',
      type: 'INVALID_ENUM_VALUE',
    };

    expect(() => organizationEntityToDTO(entity)).toThrowError(
      'Domain validation error: Invalid organization type "INVALID_ENUM_VALUE" for organization ID "org-303"'
    );
  });
});