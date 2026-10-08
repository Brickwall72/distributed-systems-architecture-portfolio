// File: services/core/topology-service/server/src/routes/assets/asset.dto.mapper.ts
import type { AssetDTO } from '@contracts/topology';
import type { AssetEntity } from '../../domain';

export function assetEntityToDTO(entity: AssetEntity): AssetDTO {
  const effectiveNomenclature = entity.nomenclature?.trim() || entity.id;
  return {
    id: entity.id,
    name: effectiveNomenclature,
    nomenclature: effectiveNomenclature,
    serialNumber: entity.serialNumber,
    currentOwnerId: entity.currentOwnerId || undefined,
  };
}