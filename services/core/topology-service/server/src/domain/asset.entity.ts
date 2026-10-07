// File: services/core/topology-service/server/src/domain/asset.entity.ts
export interface TopologyAssetEntity {
  id: string;
  nomenclature: string;
  serialNumber: string;
  currentOwnerId?: string;
}