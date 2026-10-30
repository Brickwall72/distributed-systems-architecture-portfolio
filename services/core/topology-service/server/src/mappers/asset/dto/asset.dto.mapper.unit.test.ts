// File: services/core/topology-service/server/src/mappers/asset/dto/asset.dto.mapper.unit.test.ts
import { AssetDTOSchema } from '@contracts/topology';
import { mockFromSchema } from '@shared/testing';
import { assetEntityToDTO } from './asset.dto.mapper';
import { assetEntitySchema } from '../../../domain';

describe('assetEntityToDTO', () => {
  it('maps a complete domain entity into a contract-valid AssetDTO', () => {
    const entity = mockFromSchema(assetEntitySchema, { nomenclature: 'AN/PRC-152A' });

    const dto = assetEntityToDTO(entity);

    expect(dto).toEqual({ ...entity, name: 'AN/PRC-152A' });
    expect(() => AssetDTOSchema.parse(dto)).not.toThrow();
  });

  it('falls back to the asset id when nomenclature is blank', () => {
    const entity = mockFromSchema(assetEntitySchema, { nomenclature: '   ' });

    const dto = assetEntityToDTO(entity);

    expect(dto.name).toBe(entity.id);
    expect(dto.nomenclature).toBe(entity.id);
  });
});
