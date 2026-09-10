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

assert.equal(stateApi.validYmd("2028-02-29"), true);
assert.equal(stateApi.validYmd("2027-02-29"), false);
assert.equal(stateApi.validYmd("2026-13-01"), false);

assert.deepEqual(
  JSON.parse(JSON.stringify(stateApi.hydrateState(null))),
  { translation: "NIV", days: {}, passageSize: "md", includeShareNote: false }
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
    "2026-02-30": { completed: true },
    "2026-08-10": null,
  },
});
assert.equal(hydrated.translation, "ESV");
assert.deepEqual(Object.keys(hydrated.days), ["2026-08-09"]);
assert.equal(hydrated.days["2026-08-09"].journal, "Saw Christ clearly.");
assert.equal(hydrated.days["2026-08-09"].completed, true);

const malformed = stateApi.hydrateState({ translation: "INVALID", days: "broken" });
assert.equal(malformed.translation, "NIV");
assert.equal(malformed.passageSize, "md");
assert.deepEqual(Object.keys(malformed.days), []);

assert.equal(stateApi.validPassageSize("lg"), "lg");
assert.equal(stateApi.validPassageSize("huge"), "md");
assert.equal(
  stateApi.hydrateState({ translation: "ESV", passageSize: "sm", days: {} }).passageSize,
  "sm"
);
assert.equal(stateApi.hydrateState({ includeShareNote: true }).includeShareNote, true);
assert.equal(stateApi.hydrateState({ includeShareNote: "yes" }).includeShareNote, false);
assert.equal(stateApi.hydrateState(null).includeShareNote, false);

const created = stateApi.ensureDay(malformed, "2026-08-11");
assert.deepEqual(JSON.parse(JSON.stringify(created)), {
  completed: false,
  journal: "",
  translation: "NIV",
});

const corruptStorage = { getItem: () => "{bad-json" };
assert.deepEqual(
  JSON.parse(JSON.stringify(stateApi.loadState(corruptStorage))),
  { translation: "NIV", days: {}, passageSize: "md", includeShareNote: false }
);

let saved;
assert.equal(stateApi.saveState(hydrated, { setItem: (_key, value) => { saved = value; } }), true);
assert.equal(JSON.parse(saved).days["2026-08-09"].completed, true);

assert.equal(
  stateApi.saveState(hydrated, { setItem: () => { throw new Error("quota exceeded"); } }),
  false
);

const exportedAt = "2026-09-11T00:00:00.000Z";
const backup = stateApi.createBackup(hydrated, exportedAt);
assert.equal(backup.product, "ChristoDay");
assert.equal(backup.schemaVersion, 1);
assert.equal(backup.exportedAt, exportedAt);
assert.equal(backup.state.days["2026-08-09"].journal, "Saw Christ clearly.");
assert.deepEqual(
  JSON.parse(JSON.stringify(stateApi.parseBackup(JSON.stringify(backup)))),
  JSON.parse(JSON.stringify(hydrated))
);
assert.throws(() => stateApi.parseBackup("{bad-json"), /valid JSON/);
assert.throws(
  () => stateApi.parseBackup(JSON.stringify({ ...backup, product: "AnotherApp" })),
  /ChristoDay backup/
);
assert.throws(
  () => stateApi.parseBackup(JSON.stringify({ ...backup, schemaVersion: 2 })),
  /newer backup format/
);
assert.throws(
  () => stateApi.parseBackup(JSON.stringify({ ...backup, state: null })),
  /missing reading data/
);
assert.throws(() => stateApi.parseBackup(" ".repeat(stateApi.MAX_BACKUP_BYTES + 1)), /too large/);

console.log("test-state.mjs: 27 hydration, persistence, and backup cases ok");
