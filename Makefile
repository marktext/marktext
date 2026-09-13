# MarkText — development setup & build
# Usage:
#   make deps      Install system dependencies (requires sudo)
#   make install   Install node modules + rebuild native deps
#   make dev       Start in development mode
#   make build     Build for Linux
#   make clean     Clean build artifacts

SHELL := /bin/bash

# System packages required for native-keymap and other native modules (Linux)
LINUX_DEPS := libx11-dev libxkbfile-dev libsecret-1-dev pkg-config build-essential python3

.PHONY: help deps install dev build clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

deps: ## Install system dependencies (requires sudo)
	sudo apt-get update && sudo apt-get install -y $(LINUX_DEPS)

install: ## Install node modules and rebuild native deps
	pnpm install

dev: ## Start MarkText in development mode
	pnpm dev

build: ## Build MarkText for Linux
	pnpm build:linux

clean: ## Clean build artifacts
	rm -rf packages/desktop/dist packages/desktop/build
	pnpm --filter marktext exec -- rm -rf dist build
