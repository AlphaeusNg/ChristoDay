import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "js/journal-history.js"), "utf8");
assert.match(source, /searchEntries/);
assert.match(source, /openReading\(entry\.ymd\)/);
assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);

const sandbox = { window: {} };
sandbox.globalThis = sandbox;
sandbox.fetch = () => {
  throw new Error("journal search must not upload");
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { searchEntries } = sandbox.window.ChristoJournalHistory;

const entries = [
  {
    ymd: "2026-06-16",
    bookKey: "matthew",
    bookLabel: "Matthew",
    ref: "Matthew 1:1-17",
    journal: "Unique grace in this genealogy",
    completed: false,
  },
  {
    ymd: "2026-06-17",
    bookKey: "mark",
    bookLabel: "Mark",
    ref: "Mark 1:1-8",
    journal: "Servant urgency toward the cross",
    completed: true,
  },
  {
    ymd: "2026-06-18",
    bookKey: "luke",
    bookLabel: "Luke",
    ref: "Luke 1:1-4",
    journal: "   ",
    completed: false,
  },
];

assert.deepEqual(
  searchEntries(entries, { query: "GRACE" }).map((entry) => entry.ymd),
  ["2026-06-16"]
);
assert.equal(searchEntries(entries, { query: "grace" })[0].journal, entries[0].journal);
assert.deepEqual(
  searchEntries(entries, { book: "mark" }).map((entry) => entry.ymd),
  ["2026-06-17"]
);
assert.deepEqual(
  searchEntries(entries, { from: "2026-06-17", to: "2026-06-17" }).map((entry) => entry.ymd),
  ["2026-06-17"]
);
assert.deepEqual(
  searchEntries(entries, { from: "2026-06-18" }).map((entry) => entry.ymd),
  []
);
assert.deepEqual(
  searchEntries(entries, {}).map((entry) => entry.ymd),
  ["2026-06-17", "2026-06-16"]
);

console.log("test-journal-history.mjs: local date, book, and text search ok");
