// File: ui-shells/domain-shells/compliance-shell/src/vite-env.d.ts

/// <reference types="vite/client" />

declare module 'pdf_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'esign_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'topology_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

declare module 'compliance_client/api/saveDocument' {
  export function saveDocument(documentUrl: string): Promise<void>;
}

declare module 'compliance_client/api/fetchDocuments' {
  export function fetchDocuments(): Promise<ComplianceDocument[]>
}

declare module 'compliance_client/contract/ComplianceDocument' {
  type ComplianceDocument = {
  [x: string]: unknown;
  id: string;
  document_type: string;
  s3_uri: string;
  status: "Pending" | "Approved" | "Rejected";
  created_at: string;
}
}

declare module 'compliance_client/widget/*' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}