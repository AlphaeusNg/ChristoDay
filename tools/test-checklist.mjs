import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { URL, TextEncoder };
vm.createContext(sandbox);
for (const file of ["schedule", "state", "reading-checklist"]) {
  vm.runInContext(readFileSync(join(root, `js/${file}.js`), "utf8"), sandbox);
}
const checklist = sandbox.ChristoChecklist;
const schedule = sandbox.ChristoSchedule;
const plan = JSON.parse(readFileSync(join(root, "data/segments.json"), "utf8"));

for (const selected of ["2026-06-01", "2026-06-15", "2026-06-20", "2026-10-14", "2026-12-20", "2028-02-20"]) {
  const result = checklist.build(plan, selected);
  assert.equal(result.start, selected < plan.meta.startDate ? plan.meta.startDate : selected);
  assert.equal(result.end, schedule.addDaysYmd(result.start, 27));
  assert.equal(result.count, 20);
  assert.equal(result.entries.length, 20);
  const dates = result.entries.map((entry) => {
    const reading = schedule.resolveReading(plan, entry.date);
    assert.equal(reading.kind, "reading");
    assert(entry.date >= result.start && entry.date <= result.end);
    assert.equal(schedule.weekdayOfYmd(entry.date) >= 1 && schedule.weekdayOfYmd(entry.date) <= 5, true);
    assert.notEqual(entry.weekday, "Saturday");
    assert.notEqual(entry.weekday, "Sunday");
    assert.equal(entry.weekday, reading.weekdayName);
    assert.equal(entry.book, reading.bookLabel);
    assert.equal(entry.reference, reading.fullRef);
    assert.deepEqual(Object.keys(entry), ["date", "weekday", "book", "reference"]);
    return entry.date;
  });
  const expected = Array.from({ length: 28 }, (_, offset) => schedule.addDaysYmd(result.start, offset))
    .filter((date) => schedule.resolveReading(plan, date).kind === "reading");
  assert.deepEqual([...dates], expected);
  assert.equal(new Set(dates).size, 20);
}

const epoch = checklist.build(plan, "2026-06-01");
assert.equal(epoch.start, "2026-06-15");
assert.equal(epoch.end, "2026-07-12");
assert.deepEqual(
  [...epoch.entries.filter((entry) => entry.weekday === "Monday").map((entry) => entry.reference)],
  ["Jude 1:1-25", "Jude 1:1-4", "Jude 1:5-16", "Jude 1:17-25"],
);
assert.equal(epoch.entries.some((entry) => entry.date === "2026-06-20" || entry.date === "2026-06-21"), false);

const ordinary = checklist.build(plan, "2026-10-14");
assert.equal(ordinary.start, "2026-10-14");
assert.equal(ordinary.end, schedule.addDaysYmd("2026-10-14", 27));
assert.equal(ordinary.entries[0].date, "2026-10-14");
assert.notEqual(ordinary.entries[0].reference, epoch.entries[0].reference);

const yearBoundary = checklist.build(plan, "2026-12-20");
assert.equal(yearBoundary.entries.some((entry) => entry.date.startsWith("2026-12")), true);
assert.equal(yearBoundary.entries.some((entry) => entry.date.startsWith("2027-01")), true);
assert.equal(yearBoundary.entries.some((entry) => entry.date === "2026-12-31" || entry.date === "2027-01-01"), true);

const leap = checklist.build(plan, "2028-02-20");
assert.equal(leap.end, "2028-03-18");
assert.equal(leap.entries.some((entry) => entry.date.startsWith("2028-02")), true);
assert.equal(leap.entries.some((entry) => entry.date.startsWith("2028-03")), true);
const leapDay = schedule.resolveReading(plan, "2028-02-29");
const leapEntry = leap.entries.find((entry) => entry.date === "2028-02-29");
if (leapDay.kind === "reading") assert.equal(leapEntry.reference, leapDay.fullRef);
else assert.equal(leapEntry, undefined);

const snapshot = structuredClone(plan);
const poisoned = structuredClone(plan);
poisoned.meta.description = "LIVE PASSAGE SENTINEL the genealogy of Jesus";
poisoned.journal = "PRIVATE JOURNAL SENTINEL";
poisoned.books.matthew.focus = "LIVE PASSAGE SENTINEL Messiah text";
poisoned.books.matthew.passage = "Chapter one verse one passage text";
poisoned.books.jude.rotations[0].passage = "Jude passage text that must stay out";
poisoned.reflectionTemplates.matthew[0] = "PRIVATE JOURNAL SENTINEL question";
poisoned.completed = true;
const clean = checklist.build(poisoned, "2026-06-16");
const printed = JSON.stringify(clean);
assert.equal(printed.includes("SENTINEL"), false);
assert.equal(printed.includes("passage"), false);
assert.equal(printed.includes("journal"), false);
assert.equal(printed.includes("genealogy"), false);
assert.equal(printed.includes("completed"), false);
assert.equal(printed.includes("Messiah-King"), false);
assert.equal(printed.includes("contend for the faith"), false);
assert.deepEqual(plan, snapshot);
assert.equal(clean.count, 20);

for (const invalid of ["2026-02-30", "bad", "9999-12-04"]) assert.throws(() => checklist.build(plan, invalid));
assert.throws(() => checklist.build(null, "2026-06-15"));

const checklistSource = readFileSync(join(root, "js/reading-checklist.js"), "utf8");
assert.equal(checklistSource.includes("☐"), false);
assert.match(checklistSource, /beforeprint/);
const css = readFileSync(join(root, "css/style.css"), "utf8");
assert.match(css, /\.checklist-box\s*\{[^}]*display:\s*inline-block/);
assert.match(css, /\.checklist-box\s*\{[^}]*height:\s*1\.1em/);

function makeNode() {
  return {
    className: "",
    textContent: "",
    hidden: false,
    disabled: false,
    children: [],
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    replaceChildren() { this.children = []; },
    append(...items) { this.children.push(...items); },
  };
}
const uiNodes = {};
for (const id of ["reading-checklist-print", "checklist-range", "btn-checklist", "checklist-status"]) {
  uiNodes[id] = makeNode();
}
sandbox.document = { createElement: makeNode };
const view = checklist.create({
  $: (selector) => uiNodes[selector.slice(1)] || null,
  getPlan: () => plan,
  getCurrentYmd: () => "2026-06-15",
});
view.refresh();
function walk(node, visit) {
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}
const boxes = [];
const text = [];
walk(uiNodes["reading-checklist-print"], (node) => {
  text.push(node.textContent);
  if (node.className === "checklist-box") boxes.push(node);
});
assert.equal(boxes.length, 20);
for (const box of boxes) {
  assert.equal(box.textContent, "");
  assert.equal(box.attributes["aria-hidden"], "true");
}
assert.equal(text.join("\n").includes("☐"), false);
assert.equal(uiNodes["checklist-range"].textContent.includes("2026-06-15 to 2026-07-12"), true);

console.log("test-checklist.mjs: epoch and ordinary windows, Jude rotation, month/year boundary, weekends excluded, 20 reference-only entries passed");
