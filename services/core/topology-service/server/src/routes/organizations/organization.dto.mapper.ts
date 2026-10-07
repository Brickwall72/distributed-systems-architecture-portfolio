// File: services/core/topology-service/server/src/routes/organizations/organization.dto.mapper.ts
import { OrganizationDTOSchema, type OrganizationDTO } from 'topology-shared';
import type { OrganizationEntity } from '../../domain';

const OrganizationTypeEnum = OrganizationDTOSchema.shape.type;

export function organizationEntityToDTO(entity: OrganizationEntity): OrganizationDTO {
  const parsedType = OrganizationTypeEnum.safeParse(entity.type);

  if (!parsedType.success) {
    throw new Error(
      `Domain validation error: Invalid organization type "${entity.type}" for organization ID "${entity.id}"`
    );
  }

  return {
    id: entity.id,
    name: entity.name,
    type: parsedType.data,
    addressLine1: entity.addressLine1,
    addressLine2: entity.addressLine2,
  };
}