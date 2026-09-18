# Motor Agéntico · local, read-only observability for AI coding agents.
#
#   make demo         synthetic home → reader passes → dry-run review → web on 127.0.0.1:8797
#   make demo-data    only the data part of the demo (no web)
#   make test         pytest + ruff + web tests + typecheck
#   make screenshots  screenshots of the demo dashboard (needs Chrome and `make demo` running)
#   make clean        delete data/, .pytest_tmp and web/.next
#
# The demo NEVER reads your real home: every source path is set explicitly
# inside data/demo (a MOTOR_CLAUDE exported in your shell profile would
# otherwise win over MOTOR_HOME), and demo/check_env.py aborts the demo
# if any resolved path falls outside it.

SHELL := /bin/bash
PY    ?= python3
VENV  := .venv
# The demo uses its own port so it never collides with (or gets confused with)
# an instance running on your real data on the default 8796.
export MOTOR_PORT ?= 8797

DEMO      := $(CURDIR)/data/demo
DEMO_HOME := $(DEMO)/home

# Everything the reader and the web need to look ONLY at the synthetic data.
export MOTOR_HOME           := $(DEMO_HOME)
export MOTOR_DB             := $(DEMO)/motor.sqlite
export MOTOR_CLAUDE         := $(DEMO_HOME)/.claude
export MOTOR_CLAUDE_JSON    := $(DEMO_HOME)/.claude.json
export MOTOR_CODEX          := $(DEMO_HOME)/.codex
export MOTOR_HERMES         := $(DEMO_HOME)/.hermes
export MOTOR_OPENCLAW       := $(DEMO_HOME)/.openclaw
export MOTOR_LAUNCHAGENTS   := $(DEMO_HOME)/Library/LaunchAgents
export MOTOR_NOTES          := $(DEMO_HOME)/Notes
export MOTOR_MCP_JSON       := $(DEMO_HOME)/projects/acme-webshop/.mcp.json
export MOTOR_CRON_COMMANDS  := 0
export MOTOR_USER           := demo
export PYTHONDONTWRITEBYTECODE := 1
unexport MOTOR_REVIEW_READS MOTOR_MULTIVERSO MOTOR_CLAUDE_CLI MOTOR_HERMES_CLI \
         OPENROUTER_API_KEY OPENROUTER_MANAGEMENT_KEY

.PHONY: demo demo-data web-build web-start test test-py lint test-web typecheck venv screenshots clean

demo: demo-data web-build web-start

demo-data:
	$(PY) demo/check_env.py "$(DEMO)"
	rm -rf "$(DEMO)"
	$(PY) demo/generate_synthetic_home.py --home "$(DEMO_HOME)"
	$(PY) reader/reader.py
	$(PY) demo/generate_synthetic_home.py --home "$(DEMO_HOME)" --rotate
	$(PY) reader/reader.py
	$(PY) reader/review.py --dry-run --save

web/node_modules:
	cd web && npm ci --no-audit --no-fund

web-build: web/node_modules
	cd web && npm run build

web-start:
	$(PY) demo/check_env.py "$(DEMO)"
	@echo "→ http://127.0.0.1:$(MOTOR_PORT)  (Ctrl-C to stop · synthetic data only)"
	cd web && npm run start

$(VENV)/bin/pytest:
	$(PY) -m venv $(VENV)
	$(VENV)/bin/pip install -q -e ".[dev]"

venv: $(VENV)/bin/pytest

test: test-py lint test-web typecheck

test-py: venv
	$(VENV)/bin/pytest

lint: venv
	$(VENV)/bin/ruff check .

test-web: web/node_modules
	cd web && npm test

typecheck: web/node_modules
	cd web && npm run typecheck

screenshots:
	scripts/screenshots.sh

clean:
	rm -rf data .pytest_tmp web/.next
