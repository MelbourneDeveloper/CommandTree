---
name: ci-prep
description: Prepare the codebase for CI. Reads the CI workflow, builds a checklist, then loops through format/lint/build/test/coverage until every single check passes. Use before submitting a PR or when the user wants to ensure CI will pass.
argument-hint: "[optional focus area]"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# CI Prep — Get the Codebase PR-Ready

You MUST NOT STOP until every check passes and coverage threshold is met.

## Step 1: Read the CI Pipeline and Build Your Checklist

Read the CI workflow file:

```bash
cat .github/workflows/ci.yml
```

Parse EVERY step in the workflow. Extract the exact commands CI runs. Build yourself a numbered checklist of every check you need to pass. This is YOUR checklist — derived from the actual CI config, not from assumptions. The CI pipeline changes over time so you MUST read it fresh and build your list from what you find.

## Step 2: Coordinate with Other Agents

You are likely working alongside other agents who are editing files concurrently. Before making changes:

1. Check TMC status and messages for active agents and locked files
2. Do NOT edit files that are locked by other agents
3. Lock files before editing them yourself
4. Communicate what you are doing via TMC broadcasts
5. After each fix cycle, check TMC again — another agent may have broken something

## Step 3: The Loop

Run through your checklist from Step 1 in order. For each check:

1. Run the exact command from CI
2. If it passes, move to the next check
3. If it fails, FIX IT. Do NOT suppress warnings, ignore errors, remove assertions, or lower thresholds. Fix the actual code.
4. Re-run that check to confirm the fix works
5. Move to the next check

When you reach the end of the checklist, GO BACK TO THE START AND RUN THE ENTIRE CHECKLIST AGAIN. Other agents are working concurrently and may have broken something you already fixed. A fix for one check may have broken an earlier check.

**Keep looping through the full checklist until you get a COMPLETE CLEAN RUN with ZERO failures from start to finish.** One clean pass is not enough if you fixed anything during that pass — you need a clean pass where NOTHING needed fixing.

Do NOT stop after one loop. Do NOT stop after two loops. Keep going until a full pass completes with every single check green on the first try.

## Step 4: Final Coordination

1. Broadcast on TMC that CI prep is complete and all checks pass
2. Release any locks you hold
3. Report the final status to the user with the output of each passing check

## Rules

- NEVER stop with failing checks. Loop until everything is green.
- NEVER suppress lint warnings, skip tests, or lower coverage thresholds.
- NEVER remove assertions to make tests pass.
- Fix the CODE, not the checks.
- If you are stuck on a failure after 3 attempts on the same issue, ask the user for help. Do NOT silently give up.
- Always coordinate with other agents via TMC. Check for messages regularly.
- Leave the codebase in a state that will pass CI on the first try.
