# File: services/core/compliance-service/server/Dockerfile
FROM base-image:local
ARG SERVICE_PATH=/app/services/core/compliance-service/server
WORKDIR /app
RUN mkdir -p "${SERVICE_PATH}/src"


COPY tsconfig.json package.json ${SERVICE_PATH}
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY src/ ${SERVICE_PATH}/src/
RUN pnpm build

WORKDIR ${SERVICE_PATH}
USER node
EXPOSE 8080

CMD ["pnpm", "start"]
