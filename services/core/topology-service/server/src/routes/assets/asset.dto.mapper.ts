// File: services/core/topology-service/server/src/routes/assets/asset.dto.mapper.ts
import type { AssetDTO } from 'topology-shared';
import type { AssetEntity } from '../../domain';

export function assetEntityToDTO(entity: AssetEntity): AssetDTO {
  return {
    id: entity.id,
    name: entity.nomenclature || entity.id,
    nomenclature: entity.nomenclature,
    serialNumber: entity.serialNumber,
    currentOwnerId: entity.currentOwnerId,
  };
}