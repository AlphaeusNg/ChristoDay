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
check(/run:\s*node tools\/test-workflow\.mjs/, "workflow enforces its own policy");

for (const suite of ["schedule", "bible", "state", "site"]) {
  check(new RegExp(`run:\\s*node tools/test-${suite}\\.mjs`), `workflow runs the ${suite} suite`);
}

check(
  /find js tools[\s\S]*-name '\*\.js'[\s\S]*-o -name '\*\.mjs'[\s\S]*xargs -0 -n1 node --check/,
  "workflow checks every JS/tool module",
);
check(/node --check sw\.js/, "workflow checks the service worker");
assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v4|node-version:\s*["']20["']/, "deprecated runtime policy stays removed");
assertions += 1;

console.log(`test-workflow.mjs: ${assertions} CI policy assertions passed`);
