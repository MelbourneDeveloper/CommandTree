.PHONY: format lint spellcheck build package test ci

format:
	npx prettier --write "src/**/*.ts"

lint:
	npx eslint src

spellcheck:
	npx cspell "src/**/*.ts"

build:
	npx tsc -p ./

package: build
	npx vsce package

UNAME := $(shell uname)
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

test: build
	npm run test:unit
	$(VSCODE_TEST)
	node tools/check-coverage.mjs

ci: format lint spellcheck build test package
