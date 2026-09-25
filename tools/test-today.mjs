import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, "js/schedule.js"), "utf8"), sandbox);
vm.runInContext(readFileSync(join(root, "js/today-rollover.js"), "utf8"), sandbox);
const schedule = sandbox.window.ChristoSchedule;
const decide = sandbox.window.ChristoToday.decideTodayRollover;

const friday = "2026-06-19";
const saturday = "2026-06-20";
const sunday = "2026-06-21";
const monday = "2026-06-22";
const historical = "2026-06-16";
assert.equal(schedule.weekdayOfYmd(friday), 5);
assert.equal(schedule.weekdayOfYmd(saturday), 6);
assert.equal(schedule.weekdayOfYmd(sunday), 0);
assert.equal(schedule.weekdayOfYmd(monday), 1);

const toWeekend = decide({
  viewedYmd: friday,
  previousToday: friday,
  nextToday: saturday,
  journalActive: false,
});
assert.equal(toWeekend.viewedYmd, saturday);
assert.equal(toWeekend.moved, true);
assert.equal(toWeekend.showTodayLabel, true);

const editingFriday = decide({
  viewedYmd: friday,
  previousToday: friday,
  nextToday: saturday,
  journalActive: true,
});
assert.equal(editingFriday.viewedYmd, friday);
assert.equal(editingFriday.moved, false);
assert.equal(editingFriday.completionYmd, friday);
assert.equal(editingFriday.showTodayLabel, false);

const toMonday = decide({
  viewedYmd: sunday,
  previousToday: sunday,
  nextToday: monday,
  journalActive: false,
});
assert.equal(toMonday.viewedYmd, monday);
assert.equal(toMonday.moved, true);
assert.equal(toMonday.completionYmd, monday);
assert.equal(toMonday.showTodayLabel, true);

const editingHistorical = decide({
  viewedYmd: historical,
  previousToday: friday,
  nextToday: saturday,
  journalActive: true,
});
assert.equal(editingHistorical.viewedYmd, historical);
assert.equal(editingHistorical.moved, false);
assert.equal(editingHistorical.completionYmd, historical);

const browsingHistorical = decide({
  viewedYmd: historical,
  previousToday: friday,
  nextToday: saturday,
  journalActive: false,
});
assert.equal(browsingHistorical.viewedYmd, historical);
assert.equal(browsingHistorical.moved, false);

const sameDay = decide({
  viewedYmd: friday,
  previousToday: friday,
  nextToday: friday,
  journalActive: false,
});
assert.equal(sameDay.moved, false);
assert.equal(sameDay.showTodayLabel, true);

const app = readFileSync(join(root, "js/app.js"), "utf8");
const toggleComplete = app.slice(
  app.indexOf("function toggleComplete"),
  app.indexOf("function updateCompleteButton")
);
assert.match(toggleComplete, /ensureDay\(currentYmd\)/);
assert.doesNotMatch(toggleComplete, /partsInSingapore\(\)\.ymd/);
assert.match(app, /if \(decision\.moved\) return renderDay\(decision\.viewedYmd\)/);

console.log("test-today.mjs: Singapore midnight, weekend, and Monday rollover ok");
