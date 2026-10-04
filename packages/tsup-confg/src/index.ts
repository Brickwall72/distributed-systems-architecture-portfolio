import { defineConfig, type Options } from "tsup";

export const nodeServerConfig: Options = {
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node26",
  sourcemap: true,
  clean: true,
  skipNodeModulesBundle: true,
  dts: false,
};

export const createNodeServerConfig = (overrideOptions: Options = {}) => {
  return defineConfig({
    ...nodeServerConfig,
    ...overrideOptions,
  });
};