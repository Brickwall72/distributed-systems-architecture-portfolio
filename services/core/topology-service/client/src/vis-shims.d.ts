// File: services/core/topology-service/client/src/vis-shims.d.ts

/*
 * Local TypeScript shims for the vis.js libraries used by the topology canvas.
 * These declarations keep the browser graph integration typed without pulling in
 * the full library definitions for the project.
 */
declare module 'vis-data' {
  export class DataSet<T> {
    constructor(data?: T[]);
    add(data: T | T[]): string[];
    update(data: Partial<T> | Partial<T>[]): string[];
    remove(id: string | number | (string | number)[]): string[];
    get(id: string | number): T | null;
    get(): T[];
  }
}

declare module 'vis-network' {
  export class Network {
    constructor(container: HTMLElement, data: { nodes: any; edges: any }, options?: any);
    destroy(): void;
    setData(data: { nodes: any; edges: any }): void;
    setOptions(options: any): void;
    on(event: string, callback: (params: any) => void): void;
  }
}
