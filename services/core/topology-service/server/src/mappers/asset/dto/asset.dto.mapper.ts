// File: services/core/topology-service/server/src/mappers/asset/dto/asset.dto.mapper.ts
import { AssetDTOSchema } from '@contracts/topology';
import type { AssetEntity } from '../../../domain';

export function assetEntityToDTO(entity: AssetEntity) {
  const effectiveNomenclature = entity.nomenclature?.trim() || entity.id;
  return AssetDTOSchema.parse({
    ...entity,
    name: effectiveNomenclature,
    nomenclature: effectiveNomenclature,
  });
}