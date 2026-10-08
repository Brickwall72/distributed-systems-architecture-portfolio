// File: services/core/topology-service/shared/src/schemas/database/asset.entity.ts
export interface AssetEntity {
  id: string;
  nomenclature: string;
  serialNumber: string;
  currentOwnerId?: string;
}