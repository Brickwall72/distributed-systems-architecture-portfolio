# File: services/core/compliance-service/client/Dockerfile
FROM base-image:local
ARG SERVICE_PATH=/app/services/core/compliance-service/client
WORKDIR /app
RUN mkdir -p "${SERVICE_PATH}/src"


COPY package.json tsconfig.json ${SERVICE_PATH}
RUN pnpm install --frozen-lockfile --ignore-scripts
# COPY vite.config.ts index.html ${SERVICE_PATH}
COPY src/ ${SERVICE_PATH}/src/
RUN pnpm build

WORKDIR ${SERVICE_PATH}
USER node
EXPOSE 3001

# CMD ["pnpm", "dev"]