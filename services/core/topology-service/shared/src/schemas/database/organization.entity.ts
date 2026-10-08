// File: services/core/topology-service/shared/src/schemas/database/organization.entity.ts
export interface OrganizationEntity {
  id: string;
  name: string;
  type: string;
  addressLine1?: string;
  addressLine2?: string;
}