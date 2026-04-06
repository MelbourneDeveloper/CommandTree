# agent-pmo:5547fd2
# =============================================================================
# Standard Makefile — CommandTree
# Cross-platform: Linux, macOS, Windows (via GNU Make)
# =============================================================================

.PHONY: build test lint fmt fmt-check format clean check ci coverage coverage-check setup spellcheck package

# -----------------------------------------------------------------------------
# OS Detection
# -----------------------------------------------------------------------------
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

# Coverage threshold (override in CI via env var)
COVERAGE_THRESHOLD ?= 80

# =============================================================================
# PRIMARY TARGETS (uniform interface — do not rename)
# =============================================================================

## build: Compile/assemble all artifacts
build:
	@echo "==> Building..."
	$(MAKE) _build

## test: Run full test suite with coverage
test:
	@echo "==> Testing..."
	$(MAKE) _test

## lint: Run all linters (fails on any warning)
lint:
	@echo "==> Linting..."
	$(MAKE) _lint

## fmt: Format all code in-place
fmt:
	@echo "==> Formatting..."
	$(MAKE) _fmt

## fmt-check: Check formatting without modifying
fmt-check:
	@echo "==> Checking format..."
	$(MAKE) _fmt_check

## clean: Remove all build artifacts
clean:
	@echo "==> Cleaning..."
	$(MAKE) _clean

## check: lint + test (pre-commit)
check: lint test

## ci: lint + test + build (full CI simulation)
ci: fmt-check lint spellcheck test build package

## coverage: Generate coverage report
coverage:
	@echo "==> Coverage report..."
	$(MAKE) _coverage

## coverage-check: Assert thresholds (exits non-zero if below)
coverage-check:
	@echo "==> Checking coverage thresholds..."
	$(MAKE) _coverage_check

## setup: Post-create dev environment setup
setup:
	@echo "==> Setting up development environment..."
	$(MAKE) _setup
	@echo "==> Setup complete. Run 'make ci' to validate."

# =============================================================================
# CUSTOM TARGETS (project-specific)
# =============================================================================

## format: Alias for fmt (backwards compatibility)
format: fmt

## spellcheck: Run cspell spell checker
spellcheck:
	npx cspell "src/**/*.ts"

## package: Build VSIX package
package: build
	npx vsce package

# =============================================================================
# TYPESCRIPT/NODE IMPLEMENTATION
# =============================================================================

UNAME := $(shell uname 2>/dev/null)
EXCLUDE_CI ?= false

VSCODE_TEST_CMD = npx vscode-test --coverage
ifeq ($(EXCLUDE_CI),true)
VSCODE_TEST_CMD += --grep @exclude-ci --invert
endif

ifeq ($(UNAME),Linux)
VSCODE_TEST = xvfb-run -a $(VSCODE_TEST_CMD)
else
VSCODE_TEST = $(VSCODE_TEST_CMD)
endif

_build:
	npx tsc -p ./

_test: _build
	npm run test:unit
	$(VSCODE_TEST)
	node tools/check-coverage.mjs

_lint:
	npx eslint src

_fmt:
	npx prettier --write "src/**/*.ts"

_fmt_check:
	npx prettier --check "src/**/*.ts"

_clean:
	$(RM) out coverage .vscode-test

_coverage:
	@echo "==> HTML report: coverage/index.html"

_coverage_check:
	node tools/check-coverage.mjs

_setup:
	npm ci

# =============================================================================
# HELP
# =============================================================================
help:
	@echo "Available targets:"
	@echo "  build          - Compile/assemble all artifacts"
	@echo "  test           - Run full test suite with coverage"
	@echo "  lint           - Run all linters (errors mode)"
	@echo "  fmt            - Format all code in-place"
	@echo "  fmt-check      - Check formatting (no modification)"
	@echo "  clean          - Remove build artifacts"
	@echo "  check          - lint + test (pre-commit)"
	@echo "  ci             - fmt-check + lint + spellcheck + test + build + package"
	@echo "  coverage       - Generate and open coverage report"
	@echo "  coverage-check - Assert coverage thresholds"
	@echo "  spellcheck     - Run cspell spell checker"
	@echo "  package        - Build VSIX package"
	@echo "  setup          - Post-create dev environment setup"
