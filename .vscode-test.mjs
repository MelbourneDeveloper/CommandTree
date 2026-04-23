import { defineConfig } from "@vscode/test-cli";
import { cpSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Copy fixtures to a temp directory so tests run in full isolation
const testWorkspace = mkdtempSync(join(tmpdir(), "commandtree-test-"));
cpSync("./src/test/fixtures/workspace", testWorkspace, { recursive: true });

const userDataDir = resolve(__dirname, ".vscode-test/user-data");

export default defineConfig({
  tests: [
    {
      files: ["out/test/e2e/**/*.test.js", "out/test/providers/**/*.test.js", "out/test/unit/**/*.test.js"],
      version: "stable",
      workspaceFolder: testWorkspace,
      extensionDevelopmentPath: "./",
      srcDir: __dirname,
      mocha: {
        ui: "tdd",
        bail: true,
        timeout: 60000,
        color: true,
        slow: 10000,
      },
      launchArgs: ["--user-data-dir", userDataDir],
    },
  ],
  coverage: {
    includeAll: true,
    // @vscode/test-cli sets report.exclude.relativePath = false, which
    // makes test-exclude match against absolute paths. Patterns must
    // start with **/ so minimatch can match any prefix.
    include: ["**/out/**/*.js"],
    exclude: [
      "**/out/test/**",
      "**/out/semantic/summariser.js", // requires Copilot auth, not available in CI
      "**/out/semantic/summaryPipeline.js", // requires Copilot auth, not available in CI
      "**/out/semantic/vscodeAdapters.js", // requires Copilot auth, not available in CI
      "**/out/semantic/adapters.js", // type-only interfaces, no runtime behavior
    ],
    reporter: ["text", "lcov", "html", "json-summary"],
    output: "./coverage",
  },
});
