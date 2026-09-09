# File: services/core/topology-service/server/Dockerfile
FROM base-image:local
ARG SERVICE_PATH=/app/services/core/topology-service/server
WORKDIR /app
RUN mkdir -p "${SERVICE_PATH}/src"


COPY tsconfig.json package.json ${SERVICE_PATH}/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY src/ ${SERVICE_PATH}/src/
RUN pnpm build

WORKDIR ${SERVICE_PATH}
RUN chown -R node:node /app
USER node
EXPOSE 8082

CMD ["pnpm", "start"]
