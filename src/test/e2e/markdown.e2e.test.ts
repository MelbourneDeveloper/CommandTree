/**
 * MARKDOWN E2E TESTS
 *
 * These tests verify markdown file discovery and preview functionality.
 * Tests are black-box only - they verify behavior through the VS Code UI.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension, sleep, getCommandTreeProvider, getTreeChildren, getLabelString } from "../helpers/helpers";
import { isCommandItem } from "../../models/TaskItem";

suite("Markdown Discovery and Preview E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    await sleep(3000);
  });

  suite("Markdown File Discovery", () => {
    test("discovers markdown files in workspace root", async function () {
      this.timeout(10000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const readmeItem = markdownItems.find(
        (item) => isCommandItem(item.data) && item.data.label.includes("README.md")
      );

      assert.ok(readmeItem, "Should discover README.md");
      assert.strictEqual(
        isCommandItem(readmeItem.data) ? readmeItem.data.type : undefined,
        "markdown",
        "README.md should be of type markdown"
      );
    });

    test("discovers markdown files in subdirectories", async function () {
      this.timeout(10000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const guideItem = markdownItems.find((item) => isCommandItem(item.data) && item.data.label.includes("guide.md"));

      assert.ok(guideItem, "Should discover guide.md in subdirectory");
      assert.strictEqual(
        isCommandItem(guideItem.data) ? guideItem.data.type : undefined,
        "markdown",
        "guide.md should be of type markdown"
      );
    });

    test("extracts description from markdown heading", async function () {
      this.timeout(10000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const readmeItem = markdownItems.find(
        (item) => isCommandItem(item.data) && item.data.label.includes("README.md")
      );

      assert.ok(readmeItem, "Should find README.md item");

      assert.ok(isCommandItem(readmeItem.data), "README.md must be a command node");
      const description = readmeItem.data.description;
      assert.ok(description !== undefined && description.length > 0, "Should have a description");
      assert.ok(description.includes("Test Project Documentation"), "Description should come from first heading");
    });

    test("sets correct file path for markdown items", async function () {
      this.timeout(10000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const readmeItem = markdownItems.find(
        (item) => isCommandItem(item.data) && item.data.label.includes("README.md")
      );

      assert.ok(readmeItem, "Should find README.md item");

      assert.ok(isCommandItem(readmeItem.data), "README.md must be a command node");
      const filePath = readmeItem.data.filePath;
      assert.ok(filePath.length > 0, "Should have a file path");
      assert.ok(filePath.endsWith("README.md"), "File path should end with README.md");
    });
  });

  suite("Markdown Preview Command", () => {
    test("openPreview command is registered", async function () {
      this.timeout(10000);

      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("commandtree.openPreview"), "openPreview command should be registered");
    });

    test("openPreview command opens markdown preview", async function () {
      this.timeout(15000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const readmeItem = markdownItems.find(
        (item) => isCommandItem(item.data) && item.data.label.includes("README.md")
      );

      assert.ok(readmeItem !== undefined && isCommandItem(readmeItem.data), "Should find README.md with task");

      const initialTabCount = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;

      await vscode.commands.executeCommand("commandtree.openPreview", readmeItem);

      await sleep(2000);

      const finalTabCount = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;
      assert.ok(finalTabCount > initialTabCount, "Preview should open a new tab");
    });

    test("run command on markdown item opens preview", async function () {
      this.timeout(15000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const guideItem = markdownItems.find((item) => isCommandItem(item.data) && item.data.label.includes("guide.md"));

      assert.ok(guideItem !== undefined && isCommandItem(guideItem.data), "Should find guide.md with task");

      const initialTabCount = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;

      await vscode.commands.executeCommand("commandtree.run", guideItem);

      await sleep(2000);

      const finalTabCount = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;
      assert.ok(finalTabCount > initialTabCount, "Running markdown item should open preview");

      // Verify markdown uses preview, not terminal (exercises TaskRunner.runMarkdownPreview routing)
      const markdownTerminals = vscode.window.terminals.filter((t) => t.name.includes("guide.md"));
      assert.strictEqual(markdownTerminals.length, 0, "Markdown preview should NOT create a terminal");
    });
  });

  suite("Markdown Item Context", () => {
    test("markdown items have correct context value", async function () {
      this.timeout(10000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const readmeItem = markdownItems.find(
        (item) => isCommandItem(item.data) && item.data.label.includes("README.md")
      );

      assert.ok(readmeItem, "Should find README.md item");

      const contextValue = readmeItem.contextValue;
      assert.ok(contextValue?.includes("markdown") === true, "Context value should include 'markdown'");
    });

    test("markdown items display with correct icon", async function () {
      this.timeout(10000);

      const provider = getCommandTreeProvider();
      const rootItems = await getTreeChildren(provider);

      const markdownCategory = rootItems.find((item) => getLabelString(item.label).toLowerCase().includes("markdown"));

      assert.ok(markdownCategory, "Should have a Markdown category");

      const markdownItems = await getTreeChildren(provider, markdownCategory);
      const readmeItem = markdownItems.find(
        (item) => isCommandItem(item.data) && item.data.label.includes("README.md")
      );

      assert.ok(readmeItem, "Should find README.md item");
      assert.ok(readmeItem.iconPath !== undefined, "Markdown item should have an icon");
    });
  });
});
