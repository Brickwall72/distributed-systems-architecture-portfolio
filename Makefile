# Makefile
.PHONY: up down dev clean logs

# Define the base docker compose command
COMPOSE := docker compose

# Start the entire environment normally
up:
	$(COMPOSE) up --build -d

# Tear down the environment gracefully
down:
	$(COMPOSE) down

# Start the environment with a specific service in dev mode
# Usage: make dev svc=services/platform/esign-service
dev:
	@if [ -z "$(svc)" ]; then \
		echo "❌ Error: Must provide svc path."; \
		echo "   Usage: make dev svc=services/platform/<service-name>"; \
		exit 1; \
	fi
	@echo "🚀 Spinning up infrastructure with dev override for $(svc)..."
	$(COMPOSE) -f compose.yaml -f $(svc)/compose.dev.yaml up --build -d --remove-orphans

# Nuclear teardown: Stop containers, remove named volumes, and clean orphans
clean:
	@echo "🧹 Scrubbing the environment..."
	$(COMPOSE) down -v --remove-orphans

# Tail logs for the entire stack or a specific service
# Usage: make logs OR make logs svc=esign-server
logs:
	$(COMPOSE) logs -f $(svc)