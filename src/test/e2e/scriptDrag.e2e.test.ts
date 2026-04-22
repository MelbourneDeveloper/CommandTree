/**
 * SPEC: command-tree-script-drag
 * E2E coverage for dragging CommandTree script rows into editors or AI panels.
 */

import * as assert from "assert";
import * as fs from "fs";
import * as vscode from "vscode";
import {
  activateExtension,
  collectLeafItems,
  executeCommand,
  getCommandTreeProvider,
} from "../helpers/helpers";
import { isCommandItem } from "../../models/TaskItem";
import type { CommandTreeItem } from "../../models/TaskItem";

const COMMANDTREE_CONTAINER_COMMAND = "workbench.view.extension.commandtree-container";
const REFRESH_COMMAND = "commandtree.refresh";
const URI_LIST_MIME = "text/uri-list";
const PLAIN_TEXT_MIME = "text/plain";
const COMMANDTREE_MIME = "application/vnd.commandtree.script";

interface ScriptDragController {
  readonly dragMimeTypes: readonly string[];
  handleDrag: (source: readonly CommandTreeItem[], dataTransfer: vscode.DataTransfer) => void | Thenable<void>;
}

function hasScriptDragController(value: object): value is ScriptDragController {
  const handleDrag: unknown = Reflect.get(value, "handleDrag");
  const dragMimeTypes: unknown = Reflect.get(value, "dragMimeTypes");
  return typeof handleDrag === "function" && Array.isArray(dragMimeTypes);
}

function getScriptDragController(): ScriptDragController {
  const provider = getCommandTreeProvider();
  if (!hasScriptDragController(provider)) {
    assert.fail("CommandTree provider should expose a script drag controller for tree rows");
  }
  return provider;
}

async function findShellScriptItem(): Promise<CommandTreeItem> {
  const items = await collectLeafItems(getCommandTreeProvider());
  const script = items.find((item) => isCommandItem(item.data) && item.data.type === "shell");
  if (script === undefined) {
    assert.fail("CommandTree should expose a shell script row to drag");
  }
  return script;
}

async function transferText(dataTransfer: vscode.DataTransfer, mimeType: string): Promise<string> {
  const item = dataTransfer.get(mimeType);
  assert.ok(item !== undefined, `${mimeType} drag payload should be present`);
  return await item.asString();
}

suite("Script Drag E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
  });

  test("dragging a script row exposes uri-list and plain path payloads", async function () {
    this.timeout(20000);
    await executeCommand(COMMANDTREE_CONTAINER_COMMAND);
    await executeCommand(REFRESH_COMMAND);

    const controller = getScriptDragController();
    assert.ok(controller.dragMimeTypes.includes(URI_LIST_MIME), "Tree drags should advertise URI payloads");
    assert.ok(controller.dragMimeTypes.includes(PLAIN_TEXT_MIME), "Tree drags should advertise plain path payloads");
    assert.ok(controller.dragMimeTypes.includes(COMMANDTREE_MIME), "Tree drags should advertise CommandTree payloads");

    const scriptItem = await findShellScriptItem();
    assert.ok(isCommandItem(scriptItem.data), "Dragged row should be backed by a command item");
    assert.strictEqual(scriptItem.data.type, "shell", "Dragged row should be a shell script");
    assert.ok(fs.existsSync(scriptItem.data.filePath), "Dragged script file should exist on disk");
    assert.strictEqual(scriptItem.command?.command, "vscode.open", "Clicking the row should still open the script");

    const dataTransfer = new vscode.DataTransfer();
    await controller.handleDrag([scriptItem], dataTransfer);

    const uriPayload = await transferText(dataTransfer, URI_LIST_MIME);
    const plainPayload = await transferText(dataTransfer, PLAIN_TEXT_MIME);
    const commandTreePayload = await transferText(dataTransfer, COMMANDTREE_MIME);
    assert.strictEqual(uriPayload, vscode.Uri.file(scriptItem.data.filePath).toString(), "URI payload should be file URI");
    assert.strictEqual(plainPayload, scriptItem.data.filePath, "Plain payload should be the script path");
    assert.strictEqual(commandTreePayload, scriptItem.data.id, "CommandTree payload should carry command id");
  });

  test("dragging category rows does not leak a stale script payload", async function () {
    this.timeout(15000);
    await executeCommand(COMMANDTREE_CONTAINER_COMMAND);
    await executeCommand(REFRESH_COMMAND);

    const controller = getScriptDragController();
    const category = (await getCommandTreeProvider().getChildren())[0];
    assert.ok(category !== undefined, "CommandTree should expose category rows");
    assert.ok(!isCommandItem(category.data), "Category row should not be a command item");

    const dataTransfer = new vscode.DataTransfer();
    await controller.handleDrag([category], dataTransfer);
    assert.strictEqual(dataTransfer.get(URI_LIST_MIME), undefined, "Category drags should not set URI payloads");
    assert.strictEqual(dataTransfer.get(PLAIN_TEXT_MIME), undefined, "Category drags should not set plain payloads");
    assert.strictEqual(dataTransfer.get(COMMANDTREE_MIME), undefined, "Category drags should not set command payloads");
  });
});
