// File: services/core/topology-service/server/src/domain/organization.entity.ts
export interface OrganizationEntity {
  id: string;
  name: string;
  type: string;
  addressLine1?: string;
  addressLine2?: string;
}