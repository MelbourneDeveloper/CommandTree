/**
 * Pure model selection logic — no vscode dependency.
 * Testable outside of the VS Code extension host.
 */

/** Inline Result type to avoid importing TaskItem (which depends on vscode). */
type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** The "Auto" virtual model ID — not a real endpoint. */
export const AUTO_MODEL_ID = "auto";
const NO_MODEL_ERROR = "No Copilot model available after retries";
const PICKER_CANCELLED_ERROR = "Model selection cancelled";

/** Minimal model reference for selection logic. */
export interface ModelRef {
  readonly id: string;
  readonly name: string;
}

/** Dependencies injected into model selection for testability. */
export interface ModelSelectionDeps {
  readonly getSavedId: () => string;
  readonly fetchById: (id: string) => Promise<readonly ModelRef[]>;
  readonly fetchAll: () => Promise<readonly ModelRef[]>;
  readonly promptUser: (models: readonly ModelRef[]) => Promise<ModelRef | undefined>;
  readonly saveId: (id: string) => Promise<void>;
}

/**
 * Resolves a concrete (non-auto) model from a list.
 * When preferredId is "auto", picks the first non-auto model.
 * When preferredId is specific, finds that exact model.
 */
export function pickConcreteModel(params: {
  readonly models: readonly ModelRef[];
  readonly preferredId: string;
}): ModelRef | undefined {
  if (params.preferredId === AUTO_MODEL_ID) {
    return params.models.find((m) => m.id !== AUTO_MODEL_ID) ?? params.models[0];
  }
  return params.models.find((m) => m.id === params.preferredId);
}

async function findSavedModel(deps: ModelSelectionDeps, savedId: string): Promise<ModelRef | undefined> {
  if (savedId === "") {
    return undefined;
  }
  const exact = await deps.fetchById(savedId);
  return exact[0];
}

async function fetchAvailableModels(deps: ModelSelectionDeps): Promise<Result<readonly ModelRef[], string>> {
  const allModels = await deps.fetchAll();
  return allModels.length > 0 ? ok(allModels) : err(NO_MODEL_ERROR);
}

async function promptAndSaveModel(
  deps: ModelSelectionDeps,
  models: readonly ModelRef[]
): Promise<Result<ModelRef, string>> {
  const picked = await deps.promptUser(models);
  if (picked === undefined) {
    return err(PICKER_CANCELLED_ERROR);
  }
  await deps.saveId(picked.id);
  return ok(picked);
}

/**
 * Pure model selection logic. Uses saved setting if available,
 * otherwise prompts user and persists the choice.
 */
export async function resolveModel(deps: ModelSelectionDeps): Promise<Result<ModelRef, string>> {
  const savedId = deps.getSavedId();
  const saved = await findSavedModel(deps, savedId);
  if (saved !== undefined) {
    return ok(saved);
  }

  const allResult = await fetchAvailableModels(deps);
  if (!allResult.ok) {
    return allResult;
  }
  return await promptAndSaveModel(deps, allResult.value);
}

/**
 * Pure background model selection. Uses saved setting if valid,
 * otherwise chooses an available concrete model without user prompts.
 */
export async function resolveModelAutomatically(deps: ModelSelectionDeps): Promise<Result<ModelRef, string>> {
  const saved = await findSavedModel(deps, deps.getSavedId());
  if (saved !== undefined) {
    return ok(saved);
  }

  const allResult = await fetchAvailableModels(deps);
  if (!allResult.ok) {
    return allResult;
  }

  const automatic = pickConcreteModel({ models: allResult.value, preferredId: AUTO_MODEL_ID });
  return automatic !== undefined ? ok(automatic) : err(NO_MODEL_ERROR);
}
