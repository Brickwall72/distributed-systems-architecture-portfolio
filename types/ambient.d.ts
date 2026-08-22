// File: types/ambient.d.ts

/**
 * Global Monorepo Ambient Asset Declarations
 * Informs the TypeScript compiler how to handle non-code module imports universally.
 */

declare module '*.pdf' {
  const content: string;
  export default content;
}
