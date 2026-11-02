// File: services/core/audit-ledger/server/tsup.config.ts
import { createNodeServerConfig } from "@shared/tsup-config";

export default createNodeServerConfig({
  noExternal: ["compliance-shared"],
});
