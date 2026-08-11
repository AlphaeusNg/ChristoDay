import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
let assertions = 0;

function check(pattern, message) {
  assert.match(workflow, pattern, message);
  assertions += 1;
}

check(/^name:\s*ci\s*$/m, "workflow has a stable name");
check(/push:\s*\n\s+branches:\s*\[main\]/, "workflow runs on main pushes");
check(/^\s{2}pull_request:\s*$/m, "workflow runs on pull requests");
check(/permissions:\s*\n\s+contents:\s*read/, "workflow grants read-only repository contents");
check(/concurrency:[\s\S]*group:\s*ci-.*github\.workflow.*github\.ref/, "workflow groups duplicate ref runs");
check(/cancel-in-progress:\s*true/, "workflow cancels stale runs");
check(/timeout-minutes:\s*5/, "test job has a bounded timeout");
check(/uses:\s*actions\/checkout@v7/, "workflow uses the current checkout action major");
check(/uses:\s*actions\/setup-node@v7/, "workflow uses the current setup-node action major");
check(/node-version:\s*["']24["']/, "workflow tests on Node 24 LTS");
check(/cache:\s*npm/, "workflow caches locked npm dependencies");
check(/run:\s*npm ci --ignore-scripts\b/, "workflow installs exact test dependencies");
check(/run:\s*node tools\/test-workflow\.mjs/, "workflow enforces its own policy");

for (const suite of ["schedule", "bible", "state", "site", "service-worker"]) {
  check(new RegExp(`run:\\s*node tools/test-${suite}\\.mjs`), `workflow runs the ${suite} suite`);
}

check(
  /find js tools tests[\s\S]*-name '\*\.js'[\s\S]*-o -name '\*\.mjs'[\s\S]*xargs -0 -n1 node --check/,
  "workflow checks every application, tool, and browser-test module",
);
check(/node --check sw\.js/, "workflow checks the service worker");
check(/node --check playwright\.config\.mjs/, "workflow checks the browser configuration before install");
check(
  /run:\s*npx playwright install --with-deps chromium\b/,
  "workflow installs the locked Chromium runtime",
);
check(/run:\s*npm run test:browser\b/, "workflow runs the browser journey smoke");
assert(
  workflow.indexOf("node --check sw.js") < workflow.indexOf("playwright install"),
  "cheap suites and syntax checks must finish before the Chromium install",
);
assertions += 1;
assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v4|node-version:\s*["']20["']/, "deprecated runtime policy stays removed");
assertions += 1;

console.log(`test-workflow.mjs: ${assertions} CI policy assertions passed`);
