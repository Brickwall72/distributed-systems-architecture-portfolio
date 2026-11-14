// File: services/core/topology-service/server/tsup.config.ts
import { createNodeServerConfig } from "@shared/tsup-config";

export default createNodeServerConfig({
  entry: ["src/server.ts"],
  noExternal: ["topology-shared"],
});
