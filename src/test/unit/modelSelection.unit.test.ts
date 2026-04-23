import * as assert from "assert";
import {
  pickConcreteModel,
  resolveModel,
  resolveModelAutomatically,
  AUTO_MODEL_ID,
} from "../../semantic/modelSelection";
import type { ModelRef, ModelSelectionDeps } from "../../semantic/modelSelection";

/**
 * PURE UNIT TESTS for model selection logic.
 * Tests pickConcreteModel and resolveModel — no VS Code dependency.
 * SPEC: SPEC-AI-030
 */
suite("Model Selection Unit Tests", () => {
  const GPT4: ModelRef = { id: "gpt-4o", name: "GPT-4o" };
  const CLAUDE: ModelRef = { id: "claude-sonnet", name: "Claude Sonnet" };
  const AUTO: ModelRef = { id: AUTO_MODEL_ID, name: "Auto" };

  suite("pickConcreteModel", () => {
    test("returns specific model when preferredId matches", () => {
      const result = pickConcreteModel({
        models: [GPT4, CLAUDE],
        preferredId: "claude-sonnet",
      });
      if (result === undefined) {
        assert.fail("Expected a model but got undefined");
      }
      assert.strictEqual(result.id, "claude-sonnet");
      assert.strictEqual(result.name, "Claude Sonnet");
    });

    test("returns undefined when preferredId not found", () => {
      const result = pickConcreteModel({
        models: [GPT4, CLAUDE],
        preferredId: "nonexistent-model",
      });
      assert.strictEqual(result, undefined);
    });

    test("auto picks first non-auto model", () => {
      const result = pickConcreteModel({
        models: [AUTO, GPT4, CLAUDE],
        preferredId: AUTO_MODEL_ID,
      });
      assert.strictEqual(result?.id, "gpt-4o");
    });

    test("auto falls back to first model if all are auto", () => {
      const result = pickConcreteModel({
        models: [AUTO],
        preferredId: AUTO_MODEL_ID,
      });
      assert.strictEqual(result?.id, AUTO_MODEL_ID);
    });

    test("returns undefined for empty model list", () => {
      const result = pickConcreteModel({
        models: [],
        preferredId: "gpt-4o",
      });
      assert.strictEqual(result, undefined);
    });

    test("auto with empty list returns undefined", () => {
      const result = pickConcreteModel({
        models: [],
        preferredId: AUTO_MODEL_ID,
      });
      assert.strictEqual(result, undefined);
    });
  });

  suite("resolveModel", () => {
    const createDeps = (overrides: Partial<ModelSelectionDeps> = {}): ModelSelectionDeps => ({
      getSavedId: (): string => "",
      fetchById: async (): Promise<readonly ModelRef[]> => await Promise.resolve([]),
      fetchAll: async (): Promise<readonly ModelRef[]> => await Promise.resolve([GPT4, CLAUDE]),
      promptUser: async (models: readonly ModelRef[]): Promise<ModelRef | undefined> =>
        await Promise.resolve(models[0]),
      saveId: async (): Promise<void> => {
        await Promise.resolve();
      },
      ...overrides,
    });

    test("uses saved model ID when it exists and fetches successfully", async () => {
      const deps = createDeps({
        getSavedId: (): string => "claude-sonnet",
        fetchById: async (): Promise<readonly ModelRef[]> => await Promise.resolve([CLAUDE]),
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.strictEqual(result.value.id, "claude-sonnet");
    });

    test("prompts user when no saved ID", async () => {
      let prompted = false;
      const deps = createDeps({
        getSavedId: (): string => "",
        promptUser: async (models: readonly ModelRef[]): Promise<ModelRef | undefined> => {
          prompted = true;
          return await Promise.resolve(models[0]);
        },
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.ok(prompted, "User must be prompted when no saved ID");
    });

    test("prompts user when saved ID no longer available", async () => {
      let prompted = false;
      const deps = createDeps({
        getSavedId: (): string => "deleted-model",
        fetchById: async (): Promise<readonly ModelRef[]> => await Promise.resolve([]),
        promptUser: async (models: readonly ModelRef[]): Promise<ModelRef | undefined> => {
          prompted = true;
          return await Promise.resolve(models[0]);
        },
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.ok(prompted, "User must be prompted when saved model is gone");
    });

    test("saves the user's choice after prompting", async () => {
      let savedId = "";
      const deps = createDeps({
        promptUser: async (): Promise<ModelRef | undefined> => await Promise.resolve(CLAUDE),
        saveId: async (id: string): Promise<void> => {
          savedId = id;
          await Promise.resolve();
        },
      });
      const result = await resolveModel(deps);
      assert.ok(result.ok);
      assert.strictEqual(savedId, "claude-sonnet", "Chosen model ID must be persisted");
    });

    test("returns error when user cancels picker", async () => {
      const deps = createDeps({
        promptUser: async (): Promise<ModelRef | undefined> => {
          await Promise.resolve();
          return undefined;
        },
      });
      const result = await resolveModel(deps);
      assert.ok(!result.ok);
      assert.strictEqual(result.error, "Model selection cancelled");
    });

    test("returns error when no models available", async () => {
      const deps = createDeps({
        fetchAll: async (): Promise<readonly ModelRef[]> => await Promise.resolve([]),
      });
      const result = await resolveModel(deps);
      assert.ok(!result.ok);
      assert.strictEqual(result.error, "No Copilot model available after retries");
    });

    test("automatic selection picks a concrete model without prompting", async () => {
      let prompted = false;
      let savedId = "";
      const deps = createDeps({
        promptUser: async (): Promise<ModelRef | undefined> => {
          prompted = true;
          return await Promise.resolve(CLAUDE);
        },
        saveId: async (id: string): Promise<void> => {
          savedId = id;
          await Promise.resolve();
        },
      });
      const result = await resolveModelAutomatically(deps);
      assert.ok(result.ok);
      assert.strictEqual(result.value.id, "gpt-4o");
      assert.strictEqual(prompted, false, "Automatic background selection must not open the picker");
      assert.strictEqual(savedId, "", "Automatic background selection must not persist an implicit choice");
    });
  });
});
