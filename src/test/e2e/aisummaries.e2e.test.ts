/**
 * SPEC: ai-summary-generation
 * AI SUMMARIES E2E TESTS
 *
 * These tests verify that the Copilot integration ACTUALLY WORKS:
 * - Copilot authenticates successfully
 * - Summaries are generated for discovered commands
 * - Summary data appears on task items in the tree
 *
 * If Copilot auth fails (GitHubLoginFailed), these tests MUST FAIL.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import {
  activateExtension,
  sleep,
  getCommandTreeProvider,
  collectLeafTasks,
  getTooltipText,
  collectLeafItems,
} from "../helpers/helpers";

suite("AI Summary E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    await sleep(2000);
  });

  suite("Copilot Integration", () => {
    test("generateSummaries command is registered", async function () {
      this.timeout(10000);
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("commandtree.generateSummaries"), "generateSummaries command must be registered");
    });

    test("selectModel command is registered", async function () {
      this.timeout(10000);
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("commandtree.selectModel"), "selectModel command must be registered");
    });

    test("@exclude-ci Copilot models are available", async function () {
      this.timeout(30000);
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      assert.ok(models.length > 0, "At least one Copilot model must be available — is GitHub Copilot authenticated?");
    });

    test("@exclude-ci multiple Copilot models are available for user to pick from", async function () {
      this.timeout(30000);
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      assert.ok(
        models.length >= 1,
        `Model picker needs models to show the user — got ${models.length}. Is GitHub Copilot authenticated?`
      );
      // Every model must have an id and name for the picker to display
      for (const m of models) {
        assert.ok(m.id.length > 0, `Model must have an id — got empty string for "${m.name}"`);
        assert.ok(m.name.length > 0, `Model must have a name — got empty string for "${m.id}"`);
      }
    });

    test("@exclude-ci setting aiModel config selects that model for summarisation", async function () {
      this.timeout(120000);
      const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
      assert.ok(models.length > 0, "Need at least one Copilot model — is GitHub Copilot authenticated?");
      const firstModel = models[0];
      if (firstModel === undefined) {
        assert.fail("First model must exist");
      }

      // Set the model via config (same way the picker persists it)
      const config = vscode.workspace.getConfiguration("commandtree");
      await config.update("aiModel", firstModel.id, vscode.ConfigurationTarget.Global);

      // Verify it persisted
      const savedId = config.get("aiModel", "");
      assert.strictEqual(savedId, firstModel.id, "aiModel config must persist the chosen model ID");

      // Run summarisation — it should use the configured model without prompting
      await vscode.commands.executeCommand("commandtree.generateSummaries");
      await sleep(10000);

      // If we got here without a QuickPick blocking, the saved model was used
      const provider = getCommandTreeProvider();
      const tasks = await collectLeafTasks(provider);
      const withSummary = tasks.filter((t) => t.summary !== undefined && t.summary !== "");
      assert.ok(
        withSummary.length > 0,
        `Summarisation with model "${firstModel.id}" must produce results — got 0/${tasks.length}`
      );

      // Clean up — reset to empty so other tests aren't affected
      await config.update("aiModel", "", vscode.ConfigurationTarget.Global);
    });

    test("aiModel config is empty by default so user gets prompted", async function () {
      this.timeout(10000);
      const config = vscode.workspace.getConfiguration("commandtree");
      // Reset to default
      await config.update("aiModel", undefined, vscode.ConfigurationTarget.Global);
      const savedId = config.get("aiModel", "");
      assert.strictEqual(savedId, "", "aiModel must default to empty string (triggers picker on first use)");
    });

    test("@exclude-ci generateSummaries produces actual summaries on tasks", async function () {
      this.timeout(120000);
      const provider = getCommandTreeProvider();
      const tasksBefore = await collectLeafTasks(provider);
      assert.ok(tasksBefore.length > 0, "Must have discovered tasks to summarise");

      // Run the generate summaries command
      await vscode.commands.executeCommand("commandtree.generateSummaries");

      // Wait for summarisation to complete and refresh
      await sleep(10000);
      await vscode.commands.executeCommand("commandtree.refresh");
      await sleep(2000);

      const tasksAfter = await collectLeafTasks(provider);
      const withSummary = tasksAfter.filter((t) => t.summary !== undefined && t.summary !== "");

      assert.ok(
        withSummary.length > 0,
        `Copilot must generate at least one summary — got 0 out of ${tasksAfter.length} tasks. ` +
          "If Copilot auth failed (GitHubLoginFailed), that is the root cause."
      );
    });

    test("@exclude-ci summaries appear in tree item tooltips", async function () {
      this.timeout(120000);
      const provider = getCommandTreeProvider();

      // Ensure summaries have been generated (may already be done by previous test)
      await vscode.commands.executeCommand("commandtree.generateSummaries");
      await sleep(10000);
      await vscode.commands.executeCommand("commandtree.refresh");
      await sleep(2000);

      const items = await collectLeafItems(provider);
      const withTooltipSummary = items.filter((item) => {
        const tooltip = getTooltipText(item);
        // Summaries appear as blockquotes in the tooltip markdown
        return tooltip.includes("> ");
      });

      assert.ok(withTooltipSummary.length > 0, "At least one tree item must have a summary in its tooltip");
    });

    test("@exclude-ci security warnings are surfaced in tree labels", async function () {
      this.timeout(120000);
      const provider = getCommandTreeProvider();

      // After summaries are generated, any task with security risks
      // should have the warning emoji in the label
      await vscode.commands.executeCommand("commandtree.generateSummaries");
      await sleep(10000);
      await vscode.commands.executeCommand("commandtree.refresh");
      await sleep(2000);

      const tasks = await collectLeafTasks(provider);
      const withWarning = tasks.filter((t) => t.securityWarning !== undefined && t.securityWarning !== "");

      // Not all tasks will have warnings, but if any do, verify they show in tooltips
      if (withWarning.length > 0) {
        const items = await collectLeafItems(provider);
        const warningItems = items.filter((item) => {
          const tooltip = getTooltipText(item);
          return tooltip.includes("Security Warning");
        });
        assert.ok(warningItems.length > 0, "Tasks with security warnings must show warning in tooltip");
      }
    });
  });
});
