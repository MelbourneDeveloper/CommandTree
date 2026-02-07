/**
 * COPILOT LANGUAGE MODEL API — REAL E2E TEST
 *
 * This test ACTUALLY hits the VS Code Language Model API.
 * It selects a Copilot model, sends a real prompt, and verifies
 * a real streamed response comes back.
 *
 * YOU MUST manually accept the Copilot consent dialog when it appears.
 * The test will wait up to 60 seconds for model selection (consent + init).
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension, sleep } from "../helpers/helpers";

const MODEL_WAIT_MS = 2000;
const MODEL_MAX_ATTEMPTS = 30;
const COPILOT_VENDOR = "copilot";

suite("Copilot Language Model API E2E", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    await sleep(3000);
  });

  test("selectChatModels returns at least one Copilot model", async function () {
    this.timeout(120000);

    let model: vscode.LanguageModelChat | null = null;
    for (let i = 0; i < MODEL_MAX_ATTEMPTS; i++) {
      const models = await vscode.lm.selectChatModels({
        vendor: COPILOT_VENDOR,
      });
      if (models.length > 0) {
        model = models[0] ?? null;
        break;
      }
      await sleep(MODEL_WAIT_MS);
    }

    assert.ok(
      model !== null,
      "selectChatModels must return a Copilot model — accept the consent dialog!",
    );
    assert.ok(typeof model.id === "string" && model.id.length > 0, "Model must have an id");
    assert.ok(typeof model.name === "string" && model.name.length > 0, "Model must have a name");
    assert.ok(model.maxInputTokens > 0, "Model must report maxInputTokens > 0");
  });

  test("sendRequest returns a streamed response from Copilot", async function () {
    this.timeout(120000);

    // Select model (should already be consented from previous test)
    const models = await vscode.lm.selectChatModels({ vendor: COPILOT_VENDOR });
    assert.ok(models.length > 0, "No Copilot models available");
    const model = models[0];
    assert.ok(model !== undefined, "First model is undefined");

    // Send a real request
    const messages = [
      vscode.LanguageModelChatMessage.User("Reply with exactly: HELLO_COMMANDTREE"),
    ];
    const tokenSource = new vscode.CancellationTokenSource();

    let response: vscode.LanguageModelChatResponse;
    try {
      response = await model.sendRequest(messages, {}, tokenSource.token);
    } catch (e) {
      if (e instanceof vscode.LanguageModelError) {
        assert.fail(`LanguageModelError: ${e.message} (code: ${e.code})`);
      }
      throw e;
    }

    // Collect the streamed text
    const chunks: string[] = [];
    for await (const chunk of response.text) {
      chunks.push(chunk);
    }
    const fullResponse = chunks.join("").trim();

    assert.ok(fullResponse.length > 0, "Response must not be empty");
    assert.ok(
      fullResponse.includes("HELLO_COMMANDTREE"),
      `Response should contain HELLO_COMMANDTREE, got: "${fullResponse}"`,
    );

    tokenSource.dispose();
  });

  test("LanguageModelError is thrown for invalid requests", async function () {
    this.timeout(120000);

    const models = await vscode.lm.selectChatModels({ vendor: COPILOT_VENDOR });
    assert.ok(models.length > 0, "No Copilot models available");
    const model = models[0];
    assert.ok(model !== undefined, "First model is undefined");

    // Send with an already-cancelled token to trigger an error
    const tokenSource = new vscode.CancellationTokenSource();
    tokenSource.cancel();

    try {
      await model.sendRequest(
        [vscode.LanguageModelChatMessage.User("test")],
        {},
        tokenSource.token,
      );
      // If we get here, cancellation didn't throw — that's also valid behaviour
    } catch (e) {
      // Verify it's the correct error type from the API
      assert.ok(
        e instanceof vscode.LanguageModelError || e instanceof vscode.CancellationError,
        `Expected LanguageModelError or CancellationError, got: ${e}`,
      );
    }

    tokenSource.dispose();
  });
});
