// File: services/core/topology-service/server/src/mappers/asset/dto/asset.dto.mapper.unit.test.ts
import { AssetDTOSchema } from '@contracts/topology';
import { assetEntityToDTO } from './asset.dto.mapper';
import { AssetEntity } from '../../../domain';

describe('assetEntityToDTO', () => {
  it('maps a complete domain entity into a contract-valid AssetDTO', () => {
    const entity: AssetEntity = {
      id: 'ast-101',
      nomenclature: 'AN/PRC-152A',
      serialNumber: 'SN-44912',
      currentOwnerId: 'org-302',
      status: 'AVAILABLE',
    };

    const dto = assetEntityToDTO(entity);

    // 1. Assert field mapping correctness
    expect(dto).toEqual({
      id: 'ast-101',
      name: 'AN/PRC-152A',
      nomenclature: 'AN/PRC-152A',
      serialNumber: 'SN-44912',
      currentOwnerId: 'org-302',
      status: 'AVAILABLE',
    });

    // 2. DevSecOps Boundary Check: Explicitly validate mapped DTO against the Zod schema
    expect(() => AssetDTOSchema.parse(dto)).not.toThrow();
  });
});