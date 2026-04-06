---
name: upgrade-packages
description: Upgrade all dependencies/packages to their latest versions. Use when the user says "upgrade packages", "update dependencies", "bump versions", "update packages", or "upgrade deps".
argument-hint: "[--check-only] [--major] [package-name]"
---
<!-- agent-pmo:5547fd2 -->

# Upgrade Packages

Upgrade all project dependencies to their latest compatible (or latest major, if `--major`) versions.

## Arguments

- `--check-only` — List outdated packages without upgrading. Stop after Step 2.
- `--major` — Include major version bumps (breaking changes). Without this flag, stay within semver-compatible ranges.
- Any other argument is treated as a specific package name to upgrade (instead of all packages).

## Step 1 — Detect package manager

This is a TypeScript/Node.js project using npm (`package-lock.json`).

## Step 2 — List outdated packages

```bash
npm outdated
```

**Read the docs:** https://docs.npmjs.com/cli/v10/commands/npm-update

If `--check-only` was passed, **stop here** and report the outdated list.

## Step 3 — Read the official upgrade docs

**Before running any upgrade command, fetch and read the official documentation URL above.** Use WebFetch. Do not guess at flags.

## Step 4 — Upgrade packages

```bash
npm update                                    # semver-compatible
# --major flag:
npx npm-check-updates -u && npm install       # bump to latest majors
```

## Step 5 — Verify the upgrade

```bash
make ci
```

If tests fail:
1. Read the failure output carefully
2. Check the changelog / migration guide for the upgraded packages
3. Fix breaking changes in the code
4. Re-run tests
5. If stuck after 3 attempts on the same failure, report it to the user

## Step 6 — Report

- Packages upgraded (old version -> new version)
- Packages skipped (and why)
- Build/test result after upgrade
- Any breaking changes that were fixed
- Any packages that could not be upgraded

## Rules

- **Always list outdated packages first** before upgrading anything
- **Always read the official docs** before running upgrade commands
- **Always run tests after upgrading** to catch breakage immediately
- **Never remove packages** unless explicitly deprecated and replaced
- **Never downgrade packages** unless rolling back a broken upgrade
- **Never modify lockfiles manually** — let npm regenerate them
- **Commit nothing** — leave changes in the working tree for the user to review

## Success criteria

- All outdated packages upgraded to latest compatible (or latest major if `--major`)
- Build passes
- Tests pass
- User has a clear summary of what changed
