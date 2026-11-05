// File: services/core/auth-service/server/tsup.config.ts
import { createNodeServerConfig } from "@shared/tsup-config";

export default createNodeServerConfig({
  noExternal: ["auth-shared"],
});
