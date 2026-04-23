---
name: upgrade-packages
description: Upgrade all dependencies/packages to their latest versions for the detected language(s). Use when the user says "upgrade packages", "update dependencies", "bump versions", "update packages", or "upgrade deps".
argument-hint: "[--check-only] [--major] [package-name]"
---
<!-- agent-pmo:424c8f8 -->

# Upgrade Packages

Upgrade all project dependencies to their latest compatible versions (or latest major with `--major`), then drive known vulnerabilities to zero.

## Arguments

- `--check-only` — list outdated packages and stop after Step 2.
- `--major` — allow major-version bumps; otherwise stay within semver-compatible ranges.
- Any other argument is treated as a single package name to upgrade.

## Ecosystem command reference

Look up the detected ecosystem(s) in this table and use the matching commands in each step below. Process every ecosystem present.

| Manifest | Ecosystem | Outdated | Upgrade (semver) | Upgrade (`--major`) | Audit | Override mechanism |
|---|---|---|---|---|---|---|
| `package.json` (npm) | Node | `npm outdated` | `npm update` | `npx npm-check-updates -u && npm install` | `npm audit --json` | `"overrides"` in package.json |
| `package.json` (pnpm) | Node | `pnpm outdated` | `pnpm update` | `pnpm update --latest` | `pnpm audit --json` | `"pnpm.overrides"` |
| `package.json` (yarn) | Node | `yarn outdated` | `yarn up` | `yarn up -R '**'` | `yarn npm audit --json` | `"resolutions"` |
| `Cargo.toml` | Rust | `cargo outdated` | `cargo update` | `cargo update --breaking` | `cargo audit` | `[patch.crates-io]` in Cargo.toml |
| `pyproject.toml` / `requirements.txt` | Python (pip/uv/poetry) | `pip list --outdated` · `uv pip list --outdated` · `poetry show --outdated` | `pip install -U -r requirements.txt` · `uv lock --upgrade` · `poetry update` | edit specifiers · `uv lock --upgrade` · `poetry update --latest` | `pip-audit --strict` | pin in `requirements.txt` / `constraints.txt` / `>=` in pyproject |
| `*.csproj` / `Directory.Build.props` | .NET (NuGet) | `dotnet list package --outdated --include-transitive` | `dotnet add <proj> package <Name>` (per package) or `dotnet outdated --upgrade` | same | `dotnet list package --vulnerable --include-transitive` | explicit `<PackageReference Version>` in consuming project, or `<PackageVersion>` in `Directory.Packages.props` |
| `go.mod` | Go | `go list -m -u all` | `go get -u ./... && go mod tidy` | same | `govulncheck ./...` | `replace` directive in go.mod |
| `Gemfile` | Ruby | `bundle outdated` | `bundle update` | edit Gemfile constraints then `bundle update` | `bundle audit check --update` | explicit version constraint in Gemfile |
| `composer.json` | PHP | `composer outdated` | `composer update` | edit constraints then `composer update` | `composer audit` | explicit version in composer.json |
| `pubspec.yaml` | Dart/Flutter | `dart pub outdated` | `dart pub upgrade` | `dart pub upgrade --major-versions` | `dart pub deps` + check https://osv.dev | explicit version in pubspec.yaml |
| `build.gradle(.kts)` | Gradle | `./gradlew dependencyUpdates` | edit versions then `./gradlew dependencies` | same | `./gradlew dependencyCheckAnalyze` (OWASP) | version catalog entry |
| `pom.xml` | Maven | `mvn versions:display-dependency-updates` | `mvn versions:use-latest-releases && mvn versions:commit` | same | OWASP `dependency-check` | explicit `<version>` in pom.xml |

Install scanner binaries if missing (`cargo install cargo-audit`, `pip install pip-audit`, `go install golang.org/x/vuln/cmd/govulncheck@latest`, `gem install bundler-audit`). Do not skip a scan because the tool is missing.

Authoritative upgrade docs (fetch with WebFetch before running anything non-obvious): [npm](https://docs.npmjs.com/cli/v10/commands/npm-update), [pnpm](https://pnpm.io/cli/update), [yarn](https://yarnpkg.com/cli/up), [cargo](https://doc.rust-lang.org/cargo/commands/cargo-update.html), [pip](https://pip.pypa.io/en/stable/cli/pip_install/), [uv](https://docs.astral.sh/uv/reference/cli/), [poetry](https://python-poetry.org/docs/cli/#update), [dotnet](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-add-package), [go](https://go.dev/ref/mod#go-get), [bundler](https://bundler.io/man/bundle-update.1.html), [composer](https://getcomposer.org/doc/03-cli.md#update-u-upgrade), [pub](https://dart.dev/tools/pub/cmd/pub-outdated), [gradle](https://docs.gradle.org/current/userguide/dependency_management.html), [maven](https://www.mojohaus.org/versions/versions-maven-plugin/).

## Step 1 — Detect ecosystems

Scan repo root and subdirectories for manifest files listed above. If none, stop and tell the user.

## Step 2 — List outdated packages

Run the "Outdated" column command for each detected ecosystem and show the diff to the user. If `--check-only`, stop here.

## Step 3 — Upgrade

Run the "Upgrade (semver)" column, or "Upgrade (`--major`)" if `--major` was passed. If a package name argument was given, scope the upgrade to that package.

## Step 4 — Build & test

Run `make ci` (or the project's build/test commands from the Makefile, CI workflow, or CLAUDE.md). Fix any breakage using release notes / migration guides. If stuck after 3 attempts on the same failure, stop and report.

## Step 5 — Vulnerability scan (MANDATORY)

Upgrading top-level deps does NOT guarantee transitive deps are clean. Drive the count to **zero**.

**5a. Scan** — run the "Audit" column for each ecosystem.

**5b. Read runtime constraints** — before pinning anything:
- npm: `engines.node` + `.github/workflows/*.yml` `node-version:` + `.nvmrc`
- Python: `requires-python` / `.python-version`
- .NET: `<TargetFramework(s)>` in every project
- Go: `go` directive in `go.mod`
- Rust: `rust-version` in `Cargo.toml`
- Ruby: `.ruby-version` / `ruby` directive in Gemfile

**5c. For each advisory, pick the highest compatible fix:**
1. Look up the fixed-version range (scanner output, else [osv.dev](https://osv.dev) or [github.com/advisories](https://github.com/advisories)).
2. List published versions newest-first (`npm view <pkg> versions`, `pip index versions <pkg>`, `cargo search <pkg>`, `dotnet package search <pkg>`, `gem info <pkg>`).
3. Pick the newest version that is both in the fix range AND satisfies 5b's runtime floor. Prefer a major jump only when no lower major has a fix.

**5d. Apply via the "Override mechanism" column.** Scope narrowly when consumers disagree on major (e.g. `eslint` → `ajv@6` vs `secretlint` → `ajv@8`: override to `"parent > pkg"` not top-level).

**5e. Re-install, re-scan, iterate.** Loop 5c–5e until zero. If a previous override broke Step 4, re-scope and re-run Step 4.

**5f. If zero is impossible** (no fix exists, or only fix needs an unauthorised runtime bump): list each residual advisory with package, installed version, advisory ID, severity, available fix version, reason not applied, recommended action. Do NOT suppress via `--omit=dev`, `audit.level`, allowlists, `--ignore-vuln`, etc.

## Step 6 — Report

- Packages upgraded (old → new)
- Packages skipped (and why — major without `--major`, etc.)
- Transitive overrides applied for security (package, version, scope, advisory IDs fixed)
- Residual advisories with justification (from 5f), if any
- Build/test result

## Rules

- List outdated first. Run tests after upgrading. Run the Step 5 scan — mandatory.
- Never remove packages unless deprecated and replaced. Never modify lockfiles manually — let the package manager regenerate.
- Never downgrade except to roll back a broken upgrade, or to pin a transitive via override for a security fix (Step 5d).
- Never suppress vulnerability reports (`--omit=dev`, `audit.level`, `.audit-ci.json`, `--ignore-vuln`, etc.) — fix them.
- Commit nothing — leave changes in the working tree.

## Success criteria

- Outdated packages upgraded to latest compatible (or latest major if `--major`).
- Build and tests pass.
- Vulnerability scanner reports **zero** advisories, or every residual one is listed and justified per 5f.
- Report includes any transitive overrides applied for security.
