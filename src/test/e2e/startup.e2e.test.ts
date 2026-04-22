import * as assert from "assert";
import { CommandTreeProvider } from "../../CommandTreeProvider";
import * as discovery from "../../discovery";
import type { DiscoveryResult } from "../../discovery";
import { activateExtension } from "../helpers/helpers";

type CompleteDiscovery = () => void;

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

suite("Startup E2E Tests", () => {
  test("concurrent refresh and tree read share one discovery pass", async function () {
    this.timeout(10000);
    const { workspaceRoot } = await activateExtension();
    const originalDiscoverAllTasks = discovery.discoverAllTasks;
    const completions: CompleteDiscovery[] = [];
    let discoveryCallCount = 0;

    Object.defineProperty(discovery, "discoverAllTasks", {
      configurable: true,
      value: async (): Promise<DiscoveryResult> => {
        discoveryCallCount += 1;
        await new Promise<void>((resolve) => {
          completions.push(resolve);
        });
        return emptyDiscoveryResult();
      },
    });

    try {
      const provider = new CommandTreeProvider(workspaceRoot);
      const refreshPromise = provider.refresh();
      const childrenPromise = provider.getChildren();
      const callsBeforeFirstCompletion = discoveryCallCount;

      for (const complete of completions) {
        complete();
      }
      await Promise.all([refreshPromise, childrenPromise]);

      assert.strictEqual(
        callsBeforeFirstCompletion,
        1,
        `Concurrent startup readers must share the in-flight discovery; saw ${callsBeforeFirstCompletion} calls`
      );
    } finally {
      Object.defineProperty(discovery, "discoverAllTasks", {
        configurable: true,
        value: originalDiscoverAllTasks,
      });
    }
  });
});
