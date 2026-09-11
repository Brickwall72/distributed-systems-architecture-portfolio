// File: packages/testing/src/route-tester.ts
import request from 'supertest';
import express, { Router } from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface RouteTestOptions {
  routeName: string;
  endpointPath: string;
  router: Router;
}

export function runStandardRouteTests(options: RouteTestOptions) {
  const app = express();
  app.use(express.json());
  app.use(options.endpointPath, options.router);

  describe(`${options.routeName} API Controller Behavior`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('responds with a 200 OK and returns an array payload', async () => {
      const response = await Promise.resolve(request(app).get(options.endpointPath));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('successfully processes query parameters like excludeId without crashing', async () => {
      const response = await Promise.resolve(request(app).get(`${options.endpointPath}?excludeId=org-1`));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
}