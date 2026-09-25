import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, "js/state.js"), "utf8"), sandbox);
vm.runInContext(readFileSync(join(root, "js/schedule.js"), "utf8"), sandbox);
const stateApi = sandbox.window.ChristoState;
const scheduleApi = sandbox.window.ChristoSchedule;
const plan = JSON.parse(readFileSync(join(root, "data/segments.json"), "utf8"));
assert.equal(scheduleApi.validatePlan(plan).ok, true);
const isReadingYmd = (ymd) => scheduleApi.resolveReading(plan, ymd).kind === "reading";
const todayYmd = "2026-09-11";

assert.equal(stateApi.validYmd("2028-02-29"), true);
assert.equal(stateApi.validYmd("2027-02-29"), false);
assert.equal(stateApi.validYmd("2026-13-01"), false);

assert.deepEqual(
  JSON.parse(JSON.stringify(stateApi.hydrateState(null))),
  {
    translation: "NIV",
    days: {},
    passageSize: "md",
    lineSpacing: "normal",
    readingFocus: false,
    includeShareNote: false,
  }
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
assert.equal(stateApi.validLineSpacing("open"), "open");
assert.equal(stateApi.validLineSpacing("wide"), "normal");
assert.equal(stateApi.hydrateState({ lineSpacing: "tight" }).lineSpacing, "tight");
assert.equal(stateApi.hydrateState({ readingFocus: true }).readingFocus, true);
assert.equal(stateApi.hydrateState({ readingFocus: "yes" }).readingFocus, false);
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
  {
    translation: "NIV",
    days: {},
    passageSize: "md",
    lineSpacing: "normal",
    readingFocus: false,
    includeShareNote: false,
  }
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

const datedBackup = stateApi.createBackup(hydrated, exportedAt, "2026-06-16");
assert.equal(datedBackup.currentYmd, "2026-06-16");
assert.equal(datedBackup.state.currentYmd, undefined);
assert.equal(stateApi.parseBackup(JSON.stringify(datedBackup)).currentYmd, "2026-06-16");
assert.equal(stateApi.createBackup(hydrated, exportedAt, "2026-02-30").currentYmd, undefined);
assert.equal(stateApi.parseBackup(JSON.stringify(backup)).currentYmd, undefined);

const restoredWithFocus = stateApi.parseBackup(JSON.stringify({
  ...backup,
  currentYmd: "2026-06-16",
  state: {
    ...backup.state,
    days: {
      ...backup.state.days,
      "2026-06-20": { completed: false, journal: "Weekend note", translation: "NIV" },
    },
  },
}));
assert.equal(stateApi.backupFocusYmd(restoredWithFocus), "2026-06-16");
assert.equal(stateApi.restoreOpenYmd(restoredWithFocus, todayYmd, isReadingYmd), "2026-06-16");

const lastDayOnly = stateApi.hydrateState({
  days: {
    "2026-06-15": { journal: "Jude" },
    "2026-06-16": { journal: "Matthew" },
  },
});
assert.equal(stateApi.backupFocusYmd(lastDayOnly), "2026-06-16");
assert.equal(stateApi.restoreOpenYmd(lastDayOnly, todayYmd, isReadingYmd), "2026-06-16");

assert.equal(
  stateApi.restoreOpenYmd({ currentYmd: "2026-06-20", days: lastDayOnly.days }, todayYmd, isReadingYmd),
  todayYmd
);
assert.equal(
  stateApi.restoreOpenYmd({ currentYmd: "2026-06-14", days: { "2026-06-16": { journal: "Matthew" } } }, todayYmd, isReadingYmd),
  todayYmd
);
assert.equal(
  stateApi.restoreOpenYmd({ days: { "2026-06-20": { journal: "Rest" } } }, todayYmd, isReadingYmd),
  todayYmd
);
assert.equal(stateApi.restoreOpenYmd({ days: {} }, todayYmd, isReadingYmd), todayYmd);
assert.equal(
  stateApi.restoreOpenYmd({ currentYmd: "not-a-date", days: lastDayOnly.days }, todayYmd, isReadingYmd),
  "2026-06-16"
);

let savedAfterRestore;
const restoredDated = stateApi.parseBackup(JSON.stringify(datedBackup));
assert.equal(restoredDated.currentYmd, "2026-06-16");
assert.equal(
  stateApi.saveState(restoredDated, { setItem: (_key, value) => { savedAfterRestore = value; } }),
  true
);
assert.equal(JSON.parse(savedAfterRestore).currentYmd, undefined);
assert.equal(JSON.parse(savedAfterRestore).days["2026-08-09"].journal, "Saw Christ clearly.");

console.log("test-state.mjs: hydration, persistence, backup, focus, spacing, and restore-navigation cases ok");
