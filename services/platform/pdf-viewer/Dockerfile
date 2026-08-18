# =========================================================================
# STAGE 1: THE REPOSITORY COMPILATION COMPARTMENT (Builder)
# =========================================================================
FROM node:26.7.0-alpine AS builder

# Install global pnpm engine inside the container base
RUN npm install -g pnpm@11.22.0

WORKDIR /app

# Enable high-performance BuildKit caching structures for pnpm installations
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

# Copy the monorepo root orchestration manifests required to parse workspaces
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy ONLY the target subservice manifest directory
COPY services/platform/pdf-viewer/package.json ./services/platform/pdf-viewer/

# Execute a frozen workspace dependency installation using explicit cache mounts
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store/v11 \
    pnpm install --frozen-lockfile

# Copy the entire physical source repository tree into the build container
COPY . .

# Compile TypeScript down to clean production JavaScript
RUN pnpm --filter @portfolio/pdf-viewer build

# =========================================================================
# STAGE 2: THE SECURE DEPLOYMENT EMBARKATION ENVIRONMENT (Runner)
# =========================================================================
FROM node:26.7.0-alpine AS runner

WORKDIR /app

# Copy ONLY the compiled JavaScript output from the compilation stage
COPY --from=builder /app/services/platform/pdf-viewer/dist ./dist
COPY --from=builder /app/services/platform/pdf-viewer/package.json ./package.json

# Copy root configurations required for execution context
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Re-invoke pnpm globally to fetch production runtime dependencies only
RUN npm install -g pnpm@11.22.0 && \
    --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store/v11 \
    pnpm install --prod --frozen-lockfile

# Configure the production environment variables
ENV NODE_ENV=production
ENV PORT=8084

# Establish health check boundaries for system orchestration runtimes
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8084/health || exit 1

EXPOSE 8084

# Execute the application via the lean compiled JavaScript entrypoint natively
CMD ["node", "dist/index.js"]
