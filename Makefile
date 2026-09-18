.PHONY: up down dev clean logs

COMPOSE := docker compose

# Start the entire stack in production mode
up:
	$(COMPOSE) up --build -d

# Tear down the environment
down:
	$(COMPOSE) down

# Start one or more services in dev mode
# Single service:  make dev svcs=services/platform/esign-service
# Multi-service:   make dev svcs="services/global-shell services/platform/esign-service"
dev:
	@TARGET_PATHS="$(svcs)$(svc)"; \
	if [ -z "$$TARGET_PATHS" ]; then \
		echo "❌ Error: Must provide service path(s)."; \
		echo "   Usage: make dev svcs=\"services/global-shell services/platform/esign-service\""; \
		exit 1; \
	fi; \
	COMPOSE_FLAGS="-f compose.yaml"; \
	TARGET_SERVICES=""; \
	for path in $$TARGET_PATHS; do \
		DEV_FILE="$$path/compose.dev.yaml"; \
		if [ -f "$$DEV_FILE" ]; then \
			COMPOSE_FLAGS="$$COMPOSE_FLAGS -f $$DEV_FILE"; \
			SERVICES=$$($(COMPOSE) -f $$DEV_FILE config --services 2>/dev/null); \
			TARGET_SERVICES="$$TARGET_SERVICES $$SERVICES"; \
		else \
			echo "⚠️ Warning: $$DEV_FILE not found. Skipping..."; \
		fi; \
	done; \
	if [ -z "$$TARGET_SERVICES" ]; then \
		echo "❌ No valid dev targets found."; \
		exit 1; \
	fi; \
	echo "🚀 Spinning up dev overrides for targets:$$TARGET_SERVICES"; \
	$(COMPOSE) $$COMPOSE_FLAGS up --build -d --no-deps $$TARGET_SERVICES

# Scrub environment (containers, volumes, orphans)
clean:
	@echo "🧹 Scrubbing the environment..."
	$(COMPOSE) down -v --remove-orphans

# Tail logs (Usage: make logs OR make logs svc=esign-client)
logs:
	$(COMPOSE) logs -f $(svc)