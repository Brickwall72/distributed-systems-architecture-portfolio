# File: services/platform/pdf-generator/server/Dockerfile
# syntax=docker/dockerfile:1.7
FROM base-image:local
ARG SERVICE_PATH=/app/services/platform/pdf-generator/server

# Install Chromium and dependencies using Alpine's apk package manager
RUN apk add --no-cache \
	ca-certificates \
	chromium \
	freetype \
	harfbuzz \
	nss \
	ttf-freefont

# Tell Puppeteer to use Alpine's Chromium path
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
RUN mkdir -p "${SERVICE_PATH}/src"


COPY package.json tsconfig.json ${SERVICE_PATH}/
RUN --mount=type=cache,id=distributed-platform-pnpm,target=/root/.local/share/pnpm/store \
	pnpm install --frozen-lockfile
COPY src/ ${SERVICE_PATH}/src/
RUN pnpm build

WORKDIR ${SERVICE_PATH}
RUN chown -R node:node "${SERVICE_PATH}"
USER node
EXPOSE 8080

CMD ["pnpm", "dev"]