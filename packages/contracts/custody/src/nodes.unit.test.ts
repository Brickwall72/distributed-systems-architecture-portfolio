// File: packages/contracts/custody/src/nodes.unit.test.ts
import { OrganizationSchema, AssetSchema } from './nodes.js';

describe('OrganizationSchema', () => {
  it('should parse a complete organization record', () => {
    const validOrg = {
      id: 'org_12345',
      name: '75th Innovation Command',
      type: 'MILITARY_UNIT',
      addressLine1: 'Building 100, Fort Liberty',
      addressLine2: 'Suite 200',
    };

    const result = OrganizationSchema.parse(validOrg);
    expect(result).toEqual(validOrg);
  });

  it('should parse a minimal organization with optional address fields omitted', () => {
    const minimalOrg = {
      id: 'org_67890',
      name: 'Logistics Supply Depot',
      type: 'DEPOT',
    };

    const result = OrganizationSchema.parse(minimalOrg);
    expect(result).toEqual(minimalOrg);
  });

  it('should fail validation when required fields are missing', () => {
    const missingType = {
      id: 'org_12345',
      name: 'Missing Type Org',
    };

    expect(() => OrganizationSchema.parse(missingType)).toThrow();
  });

  it('should fail validation when fields are wrong types', () => {
    const invalidTypes = {
      id: 12345, // numeric instead of string
      name: 'Invalid Org',
      type: 'DEPOT',
    };

    expect(() => OrganizationSchema.parse(invalidTypes)).toThrow();
  });
});

describe('AssetSchema', () => {
  it('should parse a complete asset record including currentOwnerId', () => {
    const validAsset = {
      id: 'asset_9901',
      nomenclature: 'AN/PRC-152A Radio',
      serialNumber: 'SN-77210-C',
      currentOwnerId: 'org_12345',
    };

    const result = AssetSchema.parse(validAsset);
    expect(result).toEqual(validAsset);
  });

  it('should parse an asset record when currentOwnerId is omitted', () => {
    const minimalAsset = {
      id: 'asset_9902',
      nomenclature: 'Ruggedized Laptop',
      serialNumber: 'SN-88102-X',
    };

    const result = AssetSchema.parse(minimalAsset);
    expect(result).toEqual(minimalAsset);
  });

  it('should fail validation when required fields are missing', () => {
    const missingSerialNumber = {
      id: 'asset_9903',
      nomenclature: 'Tactical Radio',
    };

    expect(() => AssetSchema.parse(missingSerialNumber)).toThrow();
  });

  it('should fail validation when fields are wrong types', () => {
    const invalidTypes = {
      id: 'asset_9904',
      nomenclature: 'Radio',
      serialNumber: 99812, // number instead of string
    };

    expect(() => AssetSchema.parse(invalidTypes)).toThrow();
  });
});