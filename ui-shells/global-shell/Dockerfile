# File: ui-shells/global-shell/Dockerfile
# syntax=docker/dockerfile:1.7
FROM base-image:local
ARG SERVICE_PATH=/app/ui-shells/global-shell

ARG VITE_ORIGIN=http://localhost
ENV VITE_ORIGIN=${VITE_ORIGIN}

WORKDIR /app
RUN mkdir -p "${SERVICE_PATH}/src" && apk add --no-cache gettext
# Install gettext for envsubst support (assuming an Alpine-based base image)


COPY package.json tsconfig.json ${SERVICE_PATH}/
RUN --mount=type=cache,id=distributed-platform-pnpm,target=/root/.local/share/pnpm/store \
	pnpm install --frozen-lockfile --ignore-scripts
COPY vite.config.ts index.html ${SERVICE_PATH}/
COPY public/ ${SERVICE_PATH}/public/
COPY src/ ${SERVICE_PATH}/src/
RUN pnpm build

WORKDIR ${SERVICE_PATH}
RUN chown -R node:node "${SERVICE_PATH}"
USER node
EXPOSE 3000

# Dynamically substitute environment variables into the template at container startup, then launch
# CMD ["pnpm", "start"]
CMD ["sh", "-c", ": \"${TOPOLOGY_REMOTE_ENTRY:=http://localhost/topology-shell/remoteEntry.js}\"; : \"${COMPLIANCE_REMOTE_ENTRY:=http://localhost/compliance-shell/remoteEntry.js}\"; export TOPOLOGY_REMOTE_ENTRY COMPLIANCE_REMOTE_ENTRY; envsubst '${TOPOLOGY_REMOTE_ENTRY} ${COMPLIANCE_REMOTE_ENTRY}' < public/ui-manifest.template.json > public/ui-manifest.json && exec pnpm start"]