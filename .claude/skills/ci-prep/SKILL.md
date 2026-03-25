---
name: ci-prep
description: Prepare the codebase for CI. Runs formatting, linting, spell check, build, unit tests, e2e tests, and coverage checks iteratively until everything passes. Use before submitting a PR or when the user wants to ensure CI will pass.
argument-hint: "[optional focus area]"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# CI Prep — Get the Codebase PR-Ready

You MUST NOT STOP until every check passes and coverage threshold is met. This is a loop, not a checklist you run once.

## Step 0: Read the CI Pipeline

Read the CI workflow file to understand exactly what CI will run:

```bash
cat .github/workflows/ci.yml
```

Parse every step. The CI pipeline is the source of truth for what must pass. Do NOT assume you know the steps — read them fresh every time.

## Step 1: Coordinate with Other Agents

You are likely working alongside other agents who are editing files concurrently. Before making changes:

1. Check TMC status and messages for active agents and locked files
2. Do NOT edit files that are locked by other agents
3. Lock files before editing them yourself
4. Communicate what you are doing via TMC broadcasts
5. After each fix cycle, check TMC again — another agent may have broken something

## Step 2: Run the Full CI Check Sequence

Run each CI step in order. Fix failures before moving to the next step. The sequence is derived from Step 0 but typically includes:

### 2a. Format Check

Run the format checker. If it fails, run the formatter to fix, then re-check.

### 2b. Lint

Run the linter. If it fails, fix every lint error. Do NOT suppress or ignore warnings. Re-run until clean.

### 2c. Spell Check

Run the spell checker if CI includes one. Fix any misspellings in source files.

### 2d. Build / Compile

Run the build step. Fix any compilation errors. Re-run until clean.

### 2e. Unit Tests

Run unit tests. If any fail, investigate and fix the root cause. Do NOT delete or weaken assertions. Re-run until all pass.

### 2f. E2E Tests with Coverage

Run e2e tests with coverage collection. If tests fail, fix them. If coverage is below the threshold, identify uncovered code and add tests or fix existing ones.

Note: E2E tests require no other VS Code instance running. If they cannot run in your environment, flag this to the user but still ensure everything else passes.

### 2g. Coverage Threshold

Run the coverage check. If it fails, you need more test coverage. Add assertions to existing tests or write new tests for uncovered paths.

## Step 3: Full Re-run

After fixing everything, run the ENTIRE sequence again from 2a to 2g. Other agents may have made changes while you were fixing things. You MUST verify the final state is clean.

If ANY step fails on re-run, go back to Step 2 and fix it. Repeat until a full clean run completes.

## Step 4: Final Coordination

1. Broadcast on TMC that CI prep is complete
2. Release any locks you hold
3. Report the final status to the user

## Rules

- NEVER stop with failing checks. Loop until everything is green.
- NEVER suppress lint warnings, skip tests, or lower coverage thresholds.
- NEVER remove assertions to make tests pass.
- NEVER ignore spell check failures.
- Fix the CODE, not the checks.
- If you are stuck on a failure after 3 attempts, ask the user for help. Do NOT silently give up.
- Always coordinate with other agents via TMC. Check for messages regularly.
- Leave the codebase in a state that will pass CI on the first try.
