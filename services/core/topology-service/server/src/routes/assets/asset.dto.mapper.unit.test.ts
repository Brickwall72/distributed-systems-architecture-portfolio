// File: services/core/topology-service/server/src/routes/assets/asset.dto.mapper.ts
import { AssetDTOSchema } from 'topology-shared';
import { topologyEntityToDTO } from './asset.dto.mapper.js';
import type { TopologyAssetEntity } from '../../domain/asset.entity.js';

describe('topologyEntityToDTO', () => {
  it('maps a complete domain entity into a contract-valid AssetDTO', () => {
    const entity: TopologyAssetEntity = {
      id: 'ast-101',
      nomenclature: 'AN/PRC-152A',
      serialNumber: 'SN-44912',
      currentOwnerId: 'org-302',
    };

    const dto = topologyEntityToDTO(entity);

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

  it('falls back to entity.id for name when nomenclature is an empty string', () => {
    const entity: TopologyAssetEntity = {
      id: 'ast-999',
      nomenclature: '',
      serialNumber: 'SN-00000',
    };

    const dto = topologyEntityToDTO(entity);

    expect(dto.name).toBe('ast-999');
    expect(dto.nomenclature).toBe('');
    expect(dto.currentOwnerId).toBeUndefined();

    // Verify contract compliance with fallback name
    expect(() => AssetDTOSchema.parse(dto)).not.toThrow();
  });

  it('preserves optional currentOwnerId as undefined when omitted', () => {
    const entity: TopologyAssetEntity = {
      id: 'ast-202',
      nomenclature: 'DAGR GPS Unit',
      serialNumber: 'SN-11223',
    };

    const dto = topologyEntityToDTO(entity);

    expect(dto.currentOwnerId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(dto, 'currentOwnerId')).toBeTruthy();
  });
});