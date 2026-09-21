# File: ui-shells/domain-shells/topology-shell/Dockerfile
# syntax=docker/dockerfile:1.7
FROM base-image:local
ARG SERVICE_PATH=/app/ui-shells/domain-shells/topology-shell

ARG VITE_ORIGIN=http://localhost
ENV VITE_ORIGIN=${VITE_ORIGIN}

WORKDIR /app
RUN mkdir -p "${SERVICE_PATH}/src"

COPY package.json tsconfig.json ${SERVICE_PATH}/
RUN --mount=type=cache,id=distributed-platform-pnpm,target=/root/.local/share/pnpm/store \
	pnpm install --frozen-lockfile --ignore-scripts
COPY vite.config.ts index.html ${SERVICE_PATH}/
COPY src/ ${SERVICE_PATH}/src/
RUN pnpm build

WORKDIR ${SERVICE_PATH}
RUN chown -R node:node "${SERVICE_PATH}"
USER node
EXPOSE 3000

CMD ["pnpm", "start"]