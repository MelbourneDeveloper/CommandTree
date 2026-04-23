import * as assert from "assert";
import * as vscode from "vscode";
import { activate } from "../../extension";
import * as discovery from "../../discovery";
import type { DiscoveryResult } from "../../discovery";

const WATCHDOG_MS = 4000;
const OUTCOME_ACTIVATE = "activate";
const OUTCOME_TIMEOUT = "timeout";
type Outcome = typeof OUTCOME_ACTIVATE | typeof OUTCOME_TIMEOUT;

function emptyDiscoveryResult(): DiscoveryResult {
  return {
    shell: [],
    npm: [],
    make: [],
    launch: [],
    vscode: [],
    python: [],
    powershell: [],
    gradle: [],
    cargo: [],
    maven: [],
    ant: [],
    just: [],
    taskfile: [],
    deno: [],
    rake: [],
    composer: [],
    docker: [],
    dotnet: [],
    markdown: [],
    "csharp-script": [],
    "fsharp-script": [],
    mise: [],
  };
}

interface HangHandle {
  readonly restore: () => void;
  readonly release: () => void;
  readonly wasCalled: () => boolean;
}

function stubDiscoverAllTasksAsHang(): HangHandle {
  const original = discovery.discoverAllTasks;
  let called = false;
  let resolveHang: () => void = () => undefined;
  const hang = new Promise<void>((resolve) => {
    resolveHang = resolve;
  });
  Object.defineProperty(discovery, "discoverAllTasks", {
    configurable: true,
    value: async (): Promise<DiscoveryResult> => {
      called = true;
      await hang;
      return emptyDiscoveryResult();
    },
  });
  return {
    restore: () => {
      Object.defineProperty(discovery, "discoverAllTasks", {
        configurable: true,
        value: original,
      });
    },
    release: () => resolveHang(),
    wasCalled: () => called,
  };
}

interface CommandPatch {
  readonly restore: () => void;
}

function patchRegisterCommandToTolerateDuplicates(): CommandPatch {
  const original = vscode.commands.registerCommand;
  const tolerant = (id: string, fn: (...args: readonly unknown[]) => unknown, thisArg?: unknown): vscode.Disposable => {
    try {
      return original.call(vscode.commands, id, fn, thisArg);
    } catch {
      return { dispose: (): void => undefined };
    }
  };
  Object.defineProperty(vscode.commands, "registerCommand", {
    configurable: true,
    value: tolerant,
  });
  return {
    restore: () => {
      Object.defineProperty(vscode.commands, "registerCommand", {
        configurable: true,
        value: original,
      });
    },
  };
}

function createMockContext(): {
  context: vscode.ExtensionContext;
  disposables: vscode.Disposable[];
} {
  const disposables: vscode.Disposable[] = [];
  const context = { subscriptions: disposables } as unknown as vscode.ExtensionContext;
  return { context, disposables };
}

async function raceActivateAgainstWatchdog(
  activatePromise: Promise<unknown>
): Promise<{ outcome: Outcome; timer: NodeJS.Timeout }> {
  let timer: NodeJS.Timeout = setTimeout(() => undefined, 0);
  const watchdog = new Promise<Outcome>((resolve) => {
    timer = setTimeout(() => resolve(OUTCOME_TIMEOUT), WATCHDOG_MS);
  });
  const activateArm = activatePromise.then((): Outcome => OUTCOME_ACTIVATE);
  const outcome = await Promise.race([activateArm, watchdog]);
  return { outcome, timer };
}

function disposeSafely(disposables: readonly vscode.Disposable[]): void {
  for (const d of disposables) {
    const dispose = d.dispose.bind(d);
    dispose();
  }
}

suite("Extension Activation Non-Blocking E2E Test", () => {
  test("activate() returns while initial discovery is still in flight", async function () {
    this.timeout(WATCHDOG_MS + 10000);

    const hang = stubDiscoverAllTasksAsHang();
    const commandPatch = patchRegisterCommandToTolerateDuplicates();
    const { context, disposables } = createMockContext();

    try {
      const activatePromise = activate(context);
      const { outcome, timer } = await raceActivateAgainstWatchdog(activatePromise);
      clearTimeout(timer);

      assert.strictEqual(
        outcome,
        OUTCOME_ACTIVATE,
        `activate() must return while discoverAllTasks is still pending; ` +
          `the test held discovery for ${WATCHDOG_MS}ms and activate did not resolve. ` +
          `The current code awaits initialDiscovery(), which is exactly the bug this test enforces.`
      );
      assert.ok(hang.wasCalled(), "Initial discovery must be kicked off in the background during activate()");
    } finally {
      hang.release();
      hang.restore();
      commandPatch.restore();
      disposeSafely(disposables);
    }
  });
});
