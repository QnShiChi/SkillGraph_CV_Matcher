COMPOSE := docker compose
BACKUP_DIR ?= backups/postgres
TIMESTAMP ?= $(shell date +%Y%m%d-%H%M%S)
BACKUP_FILE ?= $(BACKUP_DIR)/$(POSTGRES_DB)-$(TIMESTAMP).sql

-include .env

.PHONY: up down build restart logs ps backup-db restore migrate

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

restart: down up

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

backup-db:
	mkdir -p $(BACKUP_DIR)
	$(COMPOSE) exec -T postgres pg_dump -U $(POSTGRES_USER) -d $(POSTGRES_DB) > $(BACKUP_FILE)
	@echo "Backup created: $(BACKUP_FILE)"

restore:
	test -n "$(BACKUP_FILE)"
	test -f "$(BACKUP_FILE)"
	cat "$(BACKUP_FILE)" | $(COMPOSE) exec -T postgres psql -v ON_ERROR_STOP=1 -U $(POSTGRES_USER) -d $(POSTGRES_DB)
	@echo "Restore completed from: $(BACKUP_FILE)"

migrate:
	$(COMPOSE) exec -T backend alembic upgrade head
