# syntax=docker/dockerfile:1.7
# File: ui-shells/domain-shells/topology-shell/Dockerfile

# --- STAGE 1: Builder ---
FROM base-image:local AS builder
ARG SERVICE_PATH=/app/ui-shells/domain-shells/topology-shell

ARG VITE_ORIGIN=http://localhost
ENV VITE_ORIGIN=${VITE_ORIGIN}

WORKDIR /app

# Copy shell workspace source context
COPY . ${SERVICE_PATH}/

RUN --mount=type=cache,id=distributed-platform-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

WORKDIR ${SERVICE_PATH}
RUN pnpm build

# --- STAGE 2: Dev Target ---
FROM builder AS dev
ARG SERVICE_PATH=/app/ui-shells/domain-shells/topology-shell
WORKDIR ${SERVICE_PATH}

# Ensure 'node' user owns workspace for Vite cache creation
RUN chown -R node:node "${SERVICE_PATH}"

USER node
EXPOSE 3000

CMD ["pnpm", "dev"]

# --- STAGE 3: Static / Prod Target ---
FROM nginxinc/nginx-unprivileged:alpine AS prod
ARG SERVICE_PATH=/app/ui-shells/domain-shells/topology-shell

USER root

RUN rm -rf /usr/share/nginx/html/* && \
    rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Configure runtime permissions for unprivileged Nginx execution
RUN chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid

# Securely copy compiled static assets from builder stage
COPY --from=builder ${SERVICE_PATH}/dist /usr/share/nginx/html/topology-shell

USER nginx
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
