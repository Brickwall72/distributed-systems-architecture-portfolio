# syntax=docker/dockerfile:1.7
# File: services/platform/esign-service/client/Dockerfile

# --- STAGE 1: Builder ---
FROM base-image:local AS builder
ARG SERVICE_PATH=/app/services/platform/esign-service/client
WORKDIR /app

# Run as root. No chown required. EACCES issues are bypassed.
COPY package.json tsconfig.json vite.config.ts index.html ${SERVICE_PATH}/

RUN --mount=type=cache,id=distributed-platform-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY src/ ${SERVICE_PATH}/src/
WORKDIR ${SERVICE_PATH}
RUN pnpm build

# --- STAGE 2: Dev Target (For hot-reloading) ---
FROM builder AS dev
EXPOSE 4012
CMD ["pnpm", "dev"]

# --- STAGE 3: Static / Prod Target ---
FROM nginx:alpine AS prod
ARG SERVICE_PATH=/app/services/platform/esign-service/client

RUN rm -rf /usr/share/nginx/html/* && \
    rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Setup required permissions for the unprivileged nginx user
RUN chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid

# Securely copy only the built artifacts from the root builder, assigning them to nginx
COPY --from=builder ${SERVICE_PATH}/dist /usr/share/nginx/html

# Lock down the container for production
USER nginx
EXPOSE 4012

CMD ["nginx", "-g", "daemon off;"]