// File: services/core/topology-service/src/topologySchemas.ts

/**
 * Strict request contract for the graph authorization gate defined in Section 3.1 of the
 * system ICD and kept consistent with ADR-004. The validation flow treats the request body
 * as the authoritative security context because operational identifiers and action intent
 * are intentionally kept out of the URL, preventing log leakage and cache poisoning.
 */
export interface AuthorizationRequestPayload {
  sourceAssetId: string;   // UUIDv4 for the active aircraft or asset being evaluated.
  targetAssetId: string;   // UUIDv4 for the destination resource or airfield being checked.
  actionContext: 'SQUADRON_HANDOVER' | 'CARGO_TRANSFER'; // Legal runtime action context strings enforced by the graph rules.
}

/**
 * Canonical response shape returned by the topology validation gate. The coordinator expects
 * a uniform contract for both success and denial outcomes so downstream stages can stop or
 * continue deterministically without guessing whether the graph engine approved the path.
 */
export interface AuthorizationResponsePayload {
  status: 'AUTHORIZED' | 'DENIED';
  correlationId: string;
  timestamp: string;
  message?: string;
}

/**
 * Graph relationship view used to hydrate dashboard forms and declarative lists. This model is
 * intentionally denormalized so the UI can display an asset-to-asset link without re-running the
 * graph traversal logic in the browser.
 */
export interface TopologyEntityLink {
  sourceAssetId: string;
  sourceLabel: string;
  targetAssetId: string;
  targetLabel: string;
  actionContext: string;
}

/**
 * Aggregate response returned by the topology lookup path used for dropdown dictionaries. The
 * service keeps this contract flat and explicit so the caller receives a small, query-friendly
 * payload instead of a raw graph object graph.
 */
export interface EntityDirectoryResponsePayload {
  timestamp: string;
  connections: TopologyEntityLink[];
}
