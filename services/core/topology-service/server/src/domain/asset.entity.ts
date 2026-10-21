// File: services/core/topology-service/server/src/domain/asset.entity.ts
import { AssetStatus } from "@contracts/topology";
export interface AssetEntity {
  id: string;
  nomenclature: string;
  serialNumber: string;
  currentOwnerId: string;
  status: AssetStatus;
}