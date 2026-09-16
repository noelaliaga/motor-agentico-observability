# Motor Agéntico · local, read-only observability for AI coding agents.
#
#   make demo        synthetic home → reader passes → dry-run review → web on 127.0.0.1:8797
#   make demo-datos  only the data part of the demo (no web)
#   make test        pytest + ruff + web tests + typecheck
#   make capturas    screenshots of the demo dashboard (needs Chrome and `make demo` running)
#   make limpiar     delete data/, .pytest_tmp and web/.next
#
# The demo NEVER reads your real home: every source path is set explicitly
# inside data/demo (a MOTOR_CLAUDE exported in your shell profile would
# otherwise win over MOTOR_CASA), and demo/comprobar_entorno.py aborts the demo
# if any resolved path falls outside it.

SHELL := /bin/bash
PY    ?= python3
VENV  := .venv
# The demo uses its own port so it never collides with (or gets confused with)
# an instance running on your real data on the default 8796.
export MOTOR_PUERTO ?= 8797

DEMO      := $(CURDIR)/data/demo
DEMO_HOME := $(DEMO)/home

# Everything the reader and the web need to look ONLY at the synthetic data.
export MOTOR_CASA          := $(DEMO_HOME)
export MOTOR_BASE          := $(DEMO)/motor.sqlite
export MOTOR_CLAUDE        := $(DEMO_HOME)/.claude
export MOTOR_CLAUDE_JSON   := $(DEMO_HOME)/.claude.json
export MOTOR_CODEX         := $(DEMO_HOME)/.codex
export MOTOR_HERMES        := $(DEMO_HOME)/.hermes
export MOTOR_OPENCLAW      := $(DEMO_HOME)/.openclaw
export MOTOR_LAUNCHAGENTS  := $(DEMO_HOME)/Library/LaunchAgents
export MOTOR_NOTAS         := $(DEMO_HOME)/Notes
export MOTOR_MCP_JSON      := $(DEMO_HOME)/projects/acme-webshop/.mcp.json
export MOTOR_CRON_COMANDOS := 0
export MOTOR_USUARIO       := demo
export PYTHONDONTWRITEBYTECODE := 1
unexport MOTOR_SUENO_LEE MOTOR_MULTIVERSO MOTOR_CLAUDE_CLI MOTOR_HERMES_CLI \
         OPENROUTER_API_KEY OPENROUTER_MANAGEMENT_KEY

.PHONY: demo demo-datos web-build web-start test test-py lint test-web tipos venv capturas limpiar

demo: demo-datos web-build web-start

demo-datos:
	$(PY) demo/comprobar_entorno.py "$(DEMO)"
	rm -rf "$(DEMO)"
	$(PY) demo/generar_home_sintetica.py --casa "$(DEMO_HOME)"
	$(PY) lector/lector.py
	$(PY) demo/generar_home_sintetica.py --casa "$(DEMO_HOME)" --rotar
	$(PY) lector/lector.py
	$(PY) lector/sonar.py --seco --guardar

web/node_modules:
	cd web && npm ci --no-audit --no-fund

web-build: web/node_modules
	cd web && npm run build

web-start:
	$(PY) demo/comprobar_entorno.py "$(DEMO)"
	@echo "→ http://127.0.0.1:$(MOTOR_PUERTO)  (Ctrl-C to stop · synthetic data only)"
	cd web && npm run start

$(VENV)/bin/pytest:
	$(PY) -m venv $(VENV)
	$(VENV)/bin/pip install -q -e ".[dev]"

venv: $(VENV)/bin/pytest

test: test-py lint test-web tipos

test-py: venv
	$(VENV)/bin/pytest

lint: venv
	$(VENV)/bin/ruff check .

test-web: web/node_modules
	cd web && npm test

tipos: web/node_modules
	cd web && npm run tipos

capturas:
	scripts/capturas.sh

limpiar:
	rm -rf data .pytest_tmp web/.next
