import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadReadings() {
  const sandbox = { window: {}, localStorage: null };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, "js/red-letter.js"), "utf8"), sandbox);
  vm.runInContext(readFileSync(join(root, "js/bible.js"), "utf8"), sandbox);
  vm.runInContext(readFileSync(join(root, "js/offline-readings.js"), "utf8"), sandbox);
  return sandbox.window.ChristoReadings;
}

const readings = loadReadings();
const secret = "NIV copyrighted sentence that must stay unsaved";

for (const translation of ["NIV", "ESV", "NKJV"]) {
  const result = readings.put(readings.empty(), {
    ymd: "2026-06-16",
    translation,
    ref: "Matthew 1:1-17",
    bookKey: "matthew",
    passage: { verses: [{ chapter: 1, verse: 1, text: secret }] },
  });
  assert.equal(result.ok, false, translation);
  assert.equal(result.reason, "not-permitted");
  assert.equal(JSON.stringify(result.library).includes(secret), false, translation);
  const status = readings.availability({ translation, saved: true, loaded: "live" });
  assert.equal(status.permitted, false);
  assert.equal(status.saved, false);
  assert.match(status.text, /not stored/);
  assert.equal(status.text.includes(secret), false);
}

const webEntry = {
  ymd: "2026-06-16",
  translation: "WEB",
  ref: "Matthew 1:1-17",
  bookKey: "matthew",
  bookLabel: "Matthew",
  savedAt: "2026-09-25T00:00:00.000Z",
  passage: {
    verses: [{ chapter: 1, verse: 1, text: "The book of the generation" }],
  },
};

let raw = "";
const storage = {
  getItem: () => raw || null,
  setItem: (_key, value) => {
    raw = value;
  },
};

const saved = readings.put(readings.empty(), webEntry);
assert.equal(saved.ok, true);
assert.equal(readings.save(saved.library, storage), true);
const loaded = readings.load(storage);
assert.equal(
  readings.get(loaded, "2026-06-16", "WEB").passage.verses[0].text,
  "The book of the generation"
);
assert.equal(readings.get(loaded, "2026-06-16", "NIV"), null);
assert.match(readings.availability({ translation: "WEB", saved: true, loaded: "saved" }).text, /saved on this device/i);

const full = readings.empty();
for (let index = 0; index < readings.MAX_SAVED_READINGS; index += 1) {
  const day = String(index + 1).padStart(2, "0");
  const result = readings.put(full, {
    ymd: `2026-07-${day}`,
    translation: "WEB",
    bookKey: "matthew",
    passage: { verses: [{ chapter: 1, verse: 1, text: `Verse ${index}` }] },
  });
  assert.equal(result.ok, true, `slot ${index}`);
  Object.assign(full, result.library);
}
const overflow = readings.put(full, {
  ymd: "2026-08-03",
  translation: "WEB",
  bookKey: "matthew",
  passage: { verses: [{ chapter: 1, verse: 1, text: "One too many" }] },
});
assert.equal(overflow.ok, false);
assert.equal(overflow.reason, "full");
assert.equal(Object.keys(overflow.library.items).length, readings.MAX_SAVED_READINGS);

const replaced = readings.put(saved.library, {
  ...webEntry,
  passage: { verses: [{ chapter: 1, verse: 2, text: "Abraham begat Isaac" }] },
});
assert.equal(replaced.ok, true);
assert.equal(Object.keys(replaced.library.items).length, 1);

const removed = readings.remove(loaded, "2026-06-16", "WEB");
assert.equal(readings.save(removed, storage), true);
assert.equal(readings.get(readings.load(storage), "2026-06-16", "WEB"), null);

raw = JSON.stringify({
  items: {
    "2026-06-16:NIV": {
      ymd: "2026-06-16",
      translation: "NIV",
      passage: { verses: [{ chapter: 1, verse: 1, text: secret }] },
    },
  },
});
assert.equal(JSON.stringify(readings.load(storage)).includes(secret), false);

console.log("test-readings.mjs: permitted offline copies, refusal, bound, and removal ok");
