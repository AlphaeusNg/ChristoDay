import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "js/state.js"), "utf8");
const sandbox = { window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const stateApi = sandbox.window.ChristoState;

assert.deepEqual(
  JSON.parse(JSON.stringify(stateApi.hydrateState(null))),
  { translation: "NIV", days: {} }
);

const hydrated = stateApi.hydrateState({
  translation: "ESV",
  days: {
    "2026-08-09": {
      completed: true,
      journal: "Saw Christ clearly.",
      translation: "NKJV",
      completedAt: "2026-08-09T01:00:00.000Z",
    },
    "bad-date": { completed: true },
    "2026-08-10": null,
  },
});
assert.equal(hydrated.translation, "ESV");
assert.deepEqual(Object.keys(hydrated.days), ["2026-08-09"]);
assert.equal(hydrated.days["2026-08-09"].journal, "Saw Christ clearly.");
assert.equal(hydrated.days["2026-08-09"].completed, true);

const malformed = stateApi.hydrateState({ translation: "INVALID", days: "broken" });
assert.equal(malformed.translation, "NIV");
assert.deepEqual(Object.keys(malformed.days), []);

const created = stateApi.ensureDay(malformed, "2026-08-11");
assert.deepEqual(JSON.parse(JSON.stringify(created)), {
  completed: false,
  journal: "",
  translation: "NIV",
});

const corruptStorage = { getItem: () => "{bad-json" };
assert.deepEqual(
  JSON.parse(JSON.stringify(stateApi.loadState(corruptStorage))),
  { translation: "NIV", days: {} }
);

let saved;
assert.equal(stateApi.saveState(hydrated, { setItem: (_key, value) => { saved = value; } }), true);
assert.equal(JSON.parse(saved).days["2026-08-09"].completed, true);

assert.equal(
  stateApi.saveState(hydrated, { setItem: () => { throw new Error("quota exceeded"); } }),
  false
);

console.log("test-state.mjs: 7 hydration and persistence cases ok");
