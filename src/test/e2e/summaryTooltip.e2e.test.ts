/**
 * Exercises the summary + security-warning rendering branches in the tree:
 * createCommandNode label prefix, buildTooltip warning/summary sections,
 * and CommandTreeProvider.attachSummaries wiring.
 *
 * A real AI pipeline only runs with Copilot auth (excluded from CI), so this
 * test seeds the SQLite summary row directly via the DB's public API.
 */

import * as assert from "assert";
import {
  activateExtension,
  collectLeafTasks,
  getCommandTreeProvider,
  refreshTasks,
  getTooltipText,
} from "../helpers/helpers";
import type { CommandTreeItem } from "../../models/TaskItem";
import { upsertSummary, computeContentHash } from "../../db/db";
import { getDbOrThrow } from "../../db/lifecycle";

const WARNING_TEXT = "Runs destructive rm -rf";
const SUMMARY_TEXT = "Removes build artifacts and clears the workspace";

suite("Summary and Security Warning Rendering E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
  });

  test("tree item reflects summary and security warning seeded in the DB", async function () {
    this.timeout(20000);

    await refreshTasks();
    const tasks = await collectLeafTasks(getCommandTreeProvider());
    const target = tasks[0];
    assert.ok(target !== undefined, "Expected at least one discovered task");

    const handle = getDbOrThrow();
    upsertSummary({
      handle,
      commandId: target.id,
      contentHash: computeContentHash(target.command),
      summary: SUMMARY_TEXT,
      securityWarning: WARNING_TEXT,
    });

    await refreshTasks();

    const provider = getCommandTreeProvider();
    const all = provider.getAllTasks();
    const updated = all.find((t) => t.id === target.id);
    assert.ok(updated !== undefined, "Task should still be in the tree after refresh");
    assert.strictEqual(updated.summary, SUMMARY_TEXT, "Task should carry the seeded summary");
    assert.strictEqual(updated.securityWarning, WARNING_TEXT, "Task should carry the seeded security warning");

    const item = await findItemById(target.id);
    assert.ok(item !== undefined, `Must find the command node for ${target.id} in the rendered tree`);

    const labelText = typeof item.label === "string" ? item.label : (item.label?.label ?? "");
    assert.ok(labelText.includes("⚠"), "Label must carry the warning glyph when a security warning is set");

    const tooltip = getTooltipText(item);
    assert.ok(tooltip.includes(WARNING_TEXT), "Tooltip must render the security warning");
    assert.ok(tooltip.includes(SUMMARY_TEXT), "Tooltip must render the summary");
  });
});

async function findItemById(taskId: string): Promise<CommandTreeItem | undefined> {
  const provider = getCommandTreeProvider();
  const roots = await provider.getChildren();
  for (const root of roots) {
    const found = await searchTree(root, taskId);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

async function searchTree(node: CommandTreeItem, taskId: string): Promise<CommandTreeItem | undefined> {
  if (node.id === taskId) {
    return node;
  }
  const children = await getCommandTreeProvider().getChildren(node);
  for (const child of children) {
    const found = await searchTree(child, taskId);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}
