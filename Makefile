# agent-pmo:424c8f8
# =============================================================================
# Standard Makefile — CommandTree
# Cross-platform: Linux, macOS, Windows (via GNU Make)
# =============================================================================

.PHONY: build test lint fmt clean ci setup package test-exclude-ci help

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
VSCODE_TEST_CMD = npx vscode-test --coverage
VSCODE_TEST_EXCLUDE_CMD = npx vscode-test --coverage --grep @exclude-ci --invert
ifeq ($(UNAME),Linux)
VSCODE_TEST = xvfb-run -a $(VSCODE_TEST_CMD)
VSCODE_TEST_EXCLUDE = xvfb-run -a $(VSCODE_TEST_EXCLUDE_CMD)
else
VSCODE_TEST = $(VSCODE_TEST_CMD)
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
	@echo "==> Testing (fail-fast + coverage + threshold)..."
	npm run test:unit
	$(VSCODE_TEST)
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

## test-exclude-ci: Run tests EXCLUDING those tagged @exclude-ci (fail-fast + coverage + threshold)
test-exclude-ci: build
	@echo "==> Testing (excluding @exclude-ci, fail-fast + coverage + threshold)..."
	npm run test:unit
	$(VSCODE_TEST_EXCLUDE)
	$(MAKE) _coverage_check

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
	@echo "  test-exclude-ci  - Run tests excluding those tagged @exclude-ci"
