# agent-pmo:424c8f8
# =============================================================================
# Standard Makefile — CommandTree
# Cross-platform: Linux, macOS, Windows (via GNU Make)
# =============================================================================

.PHONY: build test lint fmt clean ci setup package test-exclude-ci reinstall help

# Extension identity — keep in sync with package.json
EXT_PUBLISHER := nimblesite
EXT_NAME      := commandtree
EXT_ID        := $(EXT_PUBLISHER).$(EXT_NAME)
EXT_VERSION   := $(shell node -p "require('./package.json').version")
VSIX_FILE     := $(EXT_NAME)-$(EXT_VERSION).vsix

# ---------------------------------------------------------------------------
# OS Detection
# ---------------------------------------------------------------------------
ifeq ($(OS),Windows_NT)
  SHELL := powershell.exe
  .SHELLFLAGS := -NoProfile -Command
  RM = Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  MKDIR = New-Item -ItemType Directory -Force
  HOME ?= $(USERPROFILE)
else
  RM = rm -rf
  MKDIR = mkdir -p
endif

# ---------------------------------------------------------------------------
# Coverage — single source of truth is coverage-thresholds.json
# See REPO-STANDARDS-SPEC [COVERAGE-THRESHOLDS-JSON].
# ---------------------------------------------------------------------------
COVERAGE_THRESHOLDS_FILE := coverage-thresholds.json

UNAME := $(shell uname 2>/dev/null)
VSCODE_TEST_EXCLUDE_CMD = npx vscode-test --coverage --bail --grep @exclude-ci --invert
ifeq ($(UNAME),Linux)
VSCODE_TEST_EXCLUDE = xvfb-run -a $(VSCODE_TEST_EXCLUDE_CMD)
else
VSCODE_TEST_EXCLUDE = $(VSCODE_TEST_EXCLUDE_CMD)
endif

# =============================================================================
# Standard Targets (exactly 7 — see REPO-STANDARDS-SPEC [MAKE-TARGETS])
# =============================================================================

## build: Compile/assemble all artifacts
build:
	@echo "==> Building..."
	npx tsc -p ./

## test: Fail-fast tests + coverage + threshold enforcement ([TEST-RULES]).
test: build
	@echo "==> Testing (excluding @exclude-ci, fail-fast + coverage + threshold)..."
	npm run test:unit
	$(VSCODE_TEST_EXCLUDE)
	$(MAKE) _coverage_check

## lint: Run all linters/analyzers (read-only). Does NOT format.
lint:
	@echo "==> Linting..."
	npx eslint src
	npx cspell "src/**/*.ts"

## fmt: Format all code in-place. Pass CHECK=1 for read-only check mode.
fmt:
	@echo "==> Formatting$(if $(CHECK), (check mode),)..."
	npx prettier $(if $(CHECK),--check,--write) "src/**/*.ts"

## clean: Remove all build artifacts
clean:
	@echo "==> Cleaning..."
	$(RM) out coverage .vscode-test

## ci: lint + test + build (full CI simulation)
ci: lint test build

## setup: Post-create dev environment setup (devcontainer hook)
setup:
	@echo "==> Setting up development environment..."
	npm ci
	@echo "==> Setup complete. Run 'make ci' to validate."

# Private recipe — called from `test`. Do not expose as a public target.
_coverage_check:
	node tools/check-coverage.mjs

# =============================================================================
# Repo-Specific Targets
# =============================================================================

## package: Build VSIX package
package: build
	npx vsce package

## test-exclude-ci: Alias for `test`; kept for existing CI workflows.
test-exclude-ci: test

## reinstall: Full clean rebuild — uninstall extension, wipe artifacts + VSIX + node_modules, reinstall deps, package, install
reinstall:
	@echo "==> Uninstalling $(EXT_ID) from VS Code..."
	-code --uninstall-extension $(EXT_ID)
	@echo "==> Cleaning build artifacts and existing VSIX files..."
	$(RM) out coverage node_modules
	$(RM) *.vsix
ifeq ($(OS),Windows_NT)
	-$(RM) .vscode-test
else
	bash -c 'set -e; \
	  dir="$(PWD)/.vscode-test"; \
	  [ -d "$$dir" ] || exit 0; \
	  echo "==> Killing processes holding files in .vscode-test..."; \
	  pids=$$(lsof +D "$$dir" 2>/dev/null | awk "NR>1 {print \$$2}" | sort -u); \
	  if [ -n "$$pids" ]; then \
	    echo "    SIGTERM: $$pids"; kill $$pids 2>/dev/null || true; sleep 1; \
	    pids=$$(lsof +D "$$dir" 2>/dev/null | awk "NR>1 {print \$$2}" | sort -u); \
	    if [ -n "$$pids" ]; then echo "    SIGKILL: $$pids"; kill -9 $$pids 2>/dev/null || true; sleep 1; fi; \
	  fi; \
	  chmod -R u+rwX "$$dir" 2>/dev/null || true; \
	  for i in 1 2 3 4 5; do rm -rf "$$dir" && break || sleep 1; done; \
	  [ ! -d "$$dir" ] || { echo "Failed to remove .vscode-test"; exit 1; }'
endif
	@echo "==> Installing dependencies..."
	npm ci
	@echo "==> Building VSIX..."
	npx tsc -p ./
	npx vsce package
	@echo "==> Installing VSIX into VS Code..."
	code --install-extension $(VSIX_FILE)
	@echo "==> Reinstall complete."

## help: List available targets
help:
	@echo "Standard targets:"
	@echo "  build    - Compile TypeScript"
	@echo "  test     - Fail-fast tests + coverage + threshold enforcement"
	@echo "  lint     - ESLint + cspell (read-only)"
	@echo "  fmt      - Prettier (CHECK=1 for verify-only)"
	@echo "  clean    - Remove build artifacts"
	@echo "  ci       - lint + test + build"
	@echo "  setup    - Post-create dev environment setup"
	@echo ""
	@echo "Repo-specific:"
	@echo "  package          - Build VSIX package"
	@echo "  test-exclude-ci  - Alias for test"
	@echo "  reinstall        - Full clean: uninstall, wipe everything, rebuild, package, install VSIX"
