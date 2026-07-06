# Telos — 常用命令。`make` 或 `make dev` = 一键本地运行。完整见 README。
.DEFAULT_GOAL := dev
.PHONY: dev serve web test build help

dev:   ## 一键本地运行：倒推代理 + 网页 + 自动开浏览器
	@./start.sh

serve: ## 只起倒推代理（:8787，读 core/.env 的 key）
	@cd core && python3 serve.py

web:   ## 只起网页（:3000，零配置自动连 serve.py）
	@cd web && npm run dev

test:  ## 跑引擎测试（Python 零依赖）
	@cd core && python3 run_tests.py

build: ## 生产构建 Cloudflare Pages 输出（landing + /app）
	@./scripts/build-pages.sh

help:  ## 列出所有命令
	@grep -hE '^[a-z]+:.*##' $(MAKEFILE_LIST) | sed -E 's/:.*## / — /' | sort
