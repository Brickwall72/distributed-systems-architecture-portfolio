// File: services/core/compliance-service/server/tsup.config.ts
import { createNodeServerConfig } from "@shared/tsup-config";

export default createNodeServerConfig({
  noExternal: ["compliance-shared"],
});
