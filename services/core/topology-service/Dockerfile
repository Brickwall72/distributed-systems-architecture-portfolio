# File: services/core/topology-service/Dockerfile
# This image follows the monorepo and compose topology documented in ADR-002 and ADR-006.
# The build stage compiles the service against the workspace graph, while the runtime stage keeps
# only the generated JavaScript plus the production dependency graph needed to boot the service.

# --- Stage 1: Build & Compilation Pass ---
FROM docker.io/library/node:26.7.0-alpine AS build-engine
WORKDIR /usr/src/app

# CORRECTED: Added the missing script guard parameter to enforce strict container build-time isolation
RUN npm install -g pnpm@11.22.0 --ignore-scripts

# Copy the repo manifests first so pnpm can resolve workspace packages and the root TypeScript
# configuration before compiling the service module in isolation.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/ ./packages/
COPY types/ ./types/
COPY services/core/topology-service/ ./services/core/topology-service/

# Install workspace dependencies in a frozen state and then build the service. The
# --ignore-scripts flag keeps bootstrap scripts from mutating the environment during container
# compilation, which matches the repo's dev setup safeguards.
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @portfolio/topology-service build

# --- Stage 2: Minimal Runtime Execution Environment ---
FROM docker.io/library/node:26.7.0-alpine AS production-runtime
WORKDIR /usr/app
ENV NODE_ENV=production

# CORRECTED: Hardened the global package manager installation inside the production execution layer
RUN npm install -g pnpm@11.22.0 --ignore-scripts

# Copy only the compiled output and the runtime metadata required to run the service; this keeps
# the final image small and avoids baking the entire source tree into production.
COPY --from=build-engine /usr/src/app/services/core/topology-service/dist ./dist
COPY --from=build-engine /usr/src/app/services/core/topology-service/package.json ./package.json
COPY --from=build-engine /usr/src/app/packages/ ./packages/
COPY --from=build-engine /usr/src/app/pnpm-workspace.yaml /usr/src/app/pnpm-lock.yaml ./

# Install only the production dependency subset, which matches the service's runtime contract and
# avoids local dev tooling leaking into the final container image.
RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

USER node
EXPOSE 8081

CMD ["node", "./dist/topologyServer.js"]
