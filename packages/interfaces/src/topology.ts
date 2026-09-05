// packages/interfaces/src/topology.ts

/**
 * Strict request contract for the graph authorization gate. 
 * Updated to evaluate organizational custody transfers rather than aircraft flight paths.
 */
export interface AuthorizationRequestPayload {
  senderOrgId: string;      // UUIDv4 or ID for the transferring organization.
  receiverOrgId: string;    // UUIDv4 or ID for the receiving organization.
  assetId: string;          // UUIDv4 for the satellite or hardware component.
  actionContext: 'CUSTODY_TRANSFER' | 'PROPERTY_HANDOVER'; // Valid space logistics actions.
}

export interface AuthorizationResponsePayload {
  status: 'AUTHORIZED' | 'DENIED';
  correlationId: string;
  timestamp: string;
  message?: string;
}

export interface CustodyItem {
  itemNumber: string;
  nomenclature: string;
  serialNumber: string;
  unit: string;
  quantity: number;
  additionalNotes?: string;
}

export interface CustodyItem {
  itemNumber: string;
  nomenclature: string;
  serialNumber: string;
  unit: string;
  quantity: number;
}


/**
 * Represents a custody transfer record mapping organizations, 
 * the formal transfer event (DD-1149 equivalent), and the asset.
 */
export interface CustodyTransferRecord {
  requisitionNumber: string;
  transferDate: string;
  senderOrgId: string;
  senderName: string;
  receiverOrgId: string;
  receiverName: string;
  assetId: string;
  assetNomenclature: string;
  serialNumber: string;
  items?: CustodyItem[];
}

/**
 * Aggregate response returned by the directory lookup path.
 */
export interface EntityDirectoryResponsePayload {
  timestamp: string;
  transfers: CustodyTransferRecord[];
}