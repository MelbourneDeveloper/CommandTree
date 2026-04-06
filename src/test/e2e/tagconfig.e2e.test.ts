/**
 * SPEC: tagging
 * E2E tests for junction table tagging system.
 * Tests exact command ID matching via SQLite junction table.
 *
 * Black-box testing through VS Code UI commands only.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension, sleep, getCommandTreeProvider } from "../helpers/helpers";
import type { CommandTreeProvider } from "../helpers/helpers";
import { getDbOrThrow } from "../../db/lifecycle";
import { getCommandIdsByTag, getTagsForCommand } from "../../db/db";

// SPEC: tagging
suite("Junction Table Tagging E2E Tests", () => {
  let treeProvider: CommandTreeProvider;

  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    treeProvider = getCommandTreeProvider();
    await sleep(2000);
  });

  // SPEC: database-schema/command-tags-junction
  test("E2E: Add tag via UI → exact ID stored in junction table", async function () {
    this.timeout(15000);

    const allTasks = treeProvider.getAllTasks();
    assert.ok(allTasks.length > 0, "Must have tasks to test tagging");
    const task = allTasks[0];
    assert.ok(task !== undefined, "First task must exist");

    const testTag = "test-tag-e2e";

    // Add tag via UI command (passing tag name for automated testing)
    await vscode.commands.executeCommand("commandtree.addTag", task, testTag);
    await sleep(500);

    // Verify tag stored in database with exact command ID
    const handle = getDbOrThrow();

    const tags = getTagsForCommand({
      handle,
      commandId: task.id,
    });
    assert.ok(tags.length > 0, "Task should have at least one tag");
    assert.ok(tags.includes(testTag), `Task should have tag "${testTag}"`);

    // Verify getAllTags includes the new tag (exercises CommandTreeProvider.getAllTags + TagConfig.getTagNames)
    const allTags = treeProvider.getAllTags();
    assert.ok(allTags.includes(testTag), `getAllTags should include "${testTag}"`);

    // Clean up
    await vscode.commands.executeCommand("commandtree.removeTag", task, testTag);
    await sleep(500);
  });

  // SPEC: database-schema/command-tags-junction
  test("E2E: Remove tag via UI → junction record deleted", async function () {
    this.timeout(15000);

    const allTasks = treeProvider.getAllTasks();
    const task = allTasks[0];
    assert.ok(task !== undefined, "First task must exist");

    const testTag = "test-remove-tag";

    // Add tag first
    await vscode.commands.executeCommand("commandtree.addTag", task, testTag);
    await sleep(500);

    const handle = getDbOrThrow();

    // Verify tag exists
    let tags = getTagsForCommand({
      handle,
      commandId: task.id,
    });
    assert.ok(tags.length > 0, "Tag should exist before removal");
    assert.ok(tags.includes(testTag), `Task should have tag "${testTag}"`);

    // Remove tag via UI
    await vscode.commands.executeCommand("commandtree.removeTag", task, testTag);
    await sleep(500);

    // Verify tag removed from database
    tags = getTagsForCommand({
      handle,
      commandId: task.id,
    });
    assert.ok(!tags.includes(testTag), `Tag "${testTag}" should be removed from command ${task.id}`);
  });

  // SPEC: database-schema/command-tags-junction
  test("E2E: Cannot add same tag twice (UNIQUE constraint)", async function () {
    this.timeout(15000);

    const allTasks = treeProvider.getAllTasks();
    const task = allTasks[0];
    assert.ok(task !== undefined, "First task must exist");

    const testTag = "test-unique-tag";

    // Add tag once
    await vscode.commands.executeCommand("commandtree.addTag", task, testTag);
    await sleep(500);

    const handle = getDbOrThrow();

    const tags1 = getTagsForCommand({
      handle,
      commandId: task.id,
    });
    assert.ok(tags1.length > 0, "Should have one tag");
    const initialCount = tags1.length;

    // Try to add same tag again (should be ignored by INSERT OR IGNORE)
    await vscode.commands.executeCommand("commandtree.addTag", task, testTag);
    await sleep(500);

    const tags2 = getTagsForCommand({
      handle,
      commandId: task.id,
    });
    assert.strictEqual(tags2.length, initialCount, "Tag count should not increase when adding duplicate");

    // Clean up
    await vscode.commands.executeCommand("commandtree.removeTag", task, testTag);
    await sleep(500);
  });

  // SPEC: database-schema/tag-operations
  test("E2E: Filter by tag → only exact ID matches shown", async function () {
    this.timeout(15000);

    const allTasks = treeProvider.getAllTasks();
    assert.ok(allTasks.length >= 2, "Need at least 2 tasks for filtering test");

    const task1 = allTasks[0];
    const task2 = allTasks[1];
    assert.ok(task1 !== undefined && task2 !== undefined, "Both tasks must exist");

    const testTag = "filter-test-tag";

    // Tag only task1
    await vscode.commands.executeCommand("commandtree.addTag", task1, testTag);
    await sleep(500);

    // Verify database has exact ID for task1 only
    const handle = getDbOrThrow();

    const taggedIds = getCommandIdsByTag({
      handle,
      tagName: testTag,
    });

    assert.ok(taggedIds.length > 0, "Should have at least one tagged command");
    assert.ok(taggedIds.includes(task1.id), `Tagged IDs should include task1 (${task1.id})`);
    assert.ok(!taggedIds.includes(task2.id), `Tagged IDs should NOT include task2 (${task2.id})`);

    // Clean up
    await vscode.commands.executeCommand("commandtree.removeTag", task1, testTag);
    await sleep(500);
  });

  // SPEC: tagging/config-file
  test("E2E: Tags from commandtree.json are synced at activation", function () {
    this.timeout(15000);

    // The fixture workspace has .vscode/commandtree.json with tags: build, test, deploy, debug, scripts, ci
    // syncTagsFromJson runs at activation, so tags should already be in DB
    const allTags = treeProvider.getAllTags();

    const expectedTags = ["build", "test", "deploy", "debug", "scripts", "ci"];
    for (const tag of expectedTags) {
      assert.ok(
        allTags.includes(tag),
        `Tag "${tag}" from commandtree.json should be synced. Found: [${allTags.join(", ")}]`
      );
    }

    // Verify pattern matching: "scripts" tag applies to shell tasks (type: "shell" pattern)
    const handle = getDbOrThrow();
    const scriptsIds = getCommandIdsByTag({
      handle,
      tagName: "scripts",
    });
    assert.ok(scriptsIds.length > 0, "scripts tag should match shell commands");

    // Verify "debug" tag applies to launch configs (type: "launch" pattern)
    const debugIds = getCommandIdsByTag({
      handle,
      tagName: "debug",
    });
    assert.ok(debugIds.length > 0, "debug tag should match launch configs");
  });
});
