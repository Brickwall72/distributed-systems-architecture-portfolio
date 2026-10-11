// File: services/platform/compliance/client/src/registry/types.ts
import { OrganizationDTO, AssetDTOList } from '@contracts/topology';

export interface ComplianceTemplateInput {
  sourceOrg?: OrganizationDTO;
  targetOrg?: OrganizationDTO;
  assets?: AssetDTOList;
  requisitionNumber?: string;
  selectedDate?: string;
}