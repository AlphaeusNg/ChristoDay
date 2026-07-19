/**
 * Node tests for ChristoDay schedule (no browser).
 * Run: node tools/test-schedule.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plan = JSON.parse(readFileSync(join(root, "data/segments.json"), "utf8"));
const scheduleSrc = readFileSync(join(root, "js/schedule.js"), "utf8");

const sandbox = { console, window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(scheduleSrc, sandbox);
const S = sandbox.window.ChristoSchedule;
if (!S) {
  console.error("Failed to load ChristoSchedule");
  process.exit(1);
}

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("  OK ", msg);
  } else {
    failed++;
    console.error("  FAIL", msg);
  }
}

console.log("ChristoDay schedule tests\n");

// Start date is Monday
assert(S.weekdayOfYmd("2026-06-15") === 1, "2026-06-15 is Monday");

// First Monday = Jude full
{
  const r = S.resolveReading(plan, "2026-06-15");
  assert(r.kind === "reading", "start day is reading");
  assert(r.bookKey === "jude", "Monday → Jude");
  assert(r.ref === "1:1-25", "first Monday Jude full");
}

// Tuesday = Matthew first segment
{
  const r = S.resolveReading(plan, "2026-06-16");
  assert(r.bookKey === "matthew" && r.ref === "1:1-17", "first Tuesday Matt 1:1-17");
}

// Wednesday Mark
{
  const r = S.resolveReading(plan, "2026-06-17");
  assert(r.bookKey === "mark" && r.ref === "1:1-8", "first Wednesday Mark 1:1-8");
}

// Thursday Philippians
{
  const r = S.resolveReading(plan, "2026-06-18");
  assert(r.bookKey === "philippians" && r.ref === "1:1-11", "first Thursday Phil 1:1-11");
}

// Friday Luke
{
  const r = S.resolveReading(plan, "2026-06-19");
  assert(r.bookKey === "luke" && r.ref === "1:1-4", "first Friday Luke 1:1-4");
}

// Weekend
{
  const r = S.resolveReading(plan, "2026-06-20");
  assert(r.kind === "weekend", "Saturday weekend");
  const r2 = S.resolveReading(plan, "2026-06-21");
  assert(r2.kind === "weekend", "Sunday weekend");
}

// Second Monday = Jude 1:1-4 (turn 2)
{
  const r = S.resolveReading(plan, "2026-06-22");
  assert(r.bookKey === "jude" && r.ref === "1:1-4", "second Monday Jude partial A");
}

// Second Tuesday = Matthew second segment
{
  const r = S.resolveReading(plan, "2026-06-23");
  assert(r.bookKey === "matthew" && r.ref === "1:18-25", "second Tuesday Matt 1:18-25");
}

// Fourth Monday %4==0 → Jude 1:17-25
{
  // Mon 15, 22, 29 Jun, 6 Jul = 4th Monday
  const r = S.resolveReading(plan, "2026-07-06");
  assert(r.bookKey === "jude" && r.ref === "1:17-25", "4th Monday Jude C");
}

// Before start
{
  const r = S.resolveReading(plan, "2026-06-01");
  assert(r.kind === "before_start", "before plan start");
}

// Segment counts match data
assert(plan.books.matthew.segments.length === 59, "Matthew 59 segments");
assert(plan.books.mark.segments.length === 37, "Mark 37 segments");
assert(plan.books.luke.segments.length === 54, "Luke 54 segments");
assert(plan.books.philippians.segments.length === 7, "Philippians 7 segments");

// Parse helpers for bible refs
const bibleSrc = readFileSync(join(root, "js/bible.js"), "utf8");
const bsandbox = { window: {}, console };
bsandbox.globalThis = bsandbox;
vm.createContext(bsandbox);
vm.runInContext(bibleSrc, bsandbox);
const B = bsandbox.window.ChristoBible;

assert(B.parseRef("1:1-17").length === 1, "simple range parse");
assert(B.parseRef("1:40-2:12").length === 2, "cross-chapter range → 2 parts");
{
  const p = B.parseRef("1:40-2:12");
  assert(p[0].chapter === 1 && p[0].verseFrom === 40, "cross start");
  assert(p[1].chapter === 2 && p[1].verseTo === 12, "cross end");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
