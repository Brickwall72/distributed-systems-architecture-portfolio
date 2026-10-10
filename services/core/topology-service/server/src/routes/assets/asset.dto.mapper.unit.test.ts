// File: services/core/topology-service/server/src/routes/assets/asset.dto.mapper.ts
import { AssetDTOSchema } from '@contracts/topology';
import { assetEntityToDTO } from './asset.dto.mapper';
import { AssetEntity } from '../../domain';

describe('assetEntityToDTO', () => {
  it('maps a complete domain entity into a contract-valid AssetDTO', () => {
    const entity: AssetEntity = {
      id: 'ast-101',
      nomenclature: 'AN/PRC-152A',
      serialNumber: 'SN-44912',
      currentOwnerId: 'org-302',
    };

    const dto = assetEntityToDTO(entity);

    // 1. Assert field mapping correctness
    expect(dto).toEqual({
      id: 'ast-101',
      name: 'AN/PRC-152A',
      nomenclature: 'AN/PRC-152A',
      serialNumber: 'SN-44912',
      currentOwnerId: 'org-302',
    });

    // 2. DevSecOps Boundary Check: Explicitly validate mapped DTO against the Zod schema
    expect(() => AssetDTOSchema.parse(dto)).not.toThrow();
  });

  it('falls back to entity.id for name and nomenclature when nomenclature is an empty string', () => {
    const entity: AssetEntity = {
      id: 'ast-999',
      nomenclature: '',
      serialNumber: 'SN-00000',
    };

    const dto = assetEntityToDTO(entity);

    expect(dto.name).toBe('ast-999');
    expect(dto.nomenclature).toBe('ast-999');
    expect(dto.currentOwnerId).toBeUndefined();

    // Contract compliance now succeeds without throwing
    expect(() => AssetDTOSchema.parse(dto)).not.toThrow();
  });

  it('preserves optional currentOwnerId as undefined when omitted', () => {
    const entity: AssetEntity = {
      id: 'ast-202',
      nomenclature: 'DAGR GPS Unit',
      serialNumber: 'SN-11223',
    };

    const dto = assetEntityToDTO(entity);

    expect(dto.currentOwnerId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(dto, 'currentOwnerId')).toBeTruthy();
  });
});