# File: services/core/topology-service/Dockerfile
FROM base-image:local
ARG SERVICE_PATH=./services/core/topology-service
WORKDIR /app
RUN mkdir -p "${SERVICE_PATH}/src"


COPY tsconfig.json package.json ${SERVICE_PATH}
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY src/ ${SERVICE_PATH}/src/
RUN pnpm build

USER node
EXPOSE 8081

CMD ["node", "./services/core/topology-service/dist/topologyServer.js"]
