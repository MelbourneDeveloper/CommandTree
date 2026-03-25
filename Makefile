.PHONY: format lint build package test ci

format:
	npx prettier --write "src/**/*.ts"

lint:
	npx eslint src

build:
	npx tsc -p ./

package: build
	npx vsce package

test: build
	npm run test:unit
	npx vscode-test --coverage

ci: format lint build test package
