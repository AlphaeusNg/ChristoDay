import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { URL, TextEncoder };
vm.createContext(sandbox);
for (const file of ["schedule", "state", "reading-calendar"]) {
  vm.runInContext(readFileSync(join(root, `js/${file}.js`), "utf8"), sandbox);
}
const calendar = sandbox.ChristoCalendar;
const schedule = sandbox.ChristoSchedule;
const plan = JSON.parse(readFileSync(join(root, "data/segments.json"), "utf8"));
const now = new Date("2026-10-13T16:30:00.000Z");
const unfold = (text) => text.replace(/\r\n /g, "");
const events = (text) => [...unfold(text).matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/g)].map((match) => match[1]);
const property = (event, key) => event.split("\r\n").find((line) => line.startsWith(`${key}:`))?.slice(key.length + 1);

for (const selected of ["2026-06-01", "2026-06-15", "2026-06-20", "2026-10-14", "2026-12-20", "2028-02-20"]) {
  const result = calendar.build(plan, selected, "ESV", now);
  assert.equal(result.start, selected < plan.meta.startDate ? plan.meta.startDate : selected);
  assert.equal(result.end, schedule.addDaysYmd(result.start, 27));
  assert.equal(result.count, 20);
  assert.equal(events(result.text).length, 20);
  assert.match(result.text, /^BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:/);
  assert.match(result.text, /\r\nEND:VCALENDAR\r\n$/);
  assert.equal(result.text.replace(/\r\n/g, "").includes("\n"), false, "CRLF only");
  for (const line of result.text.split("\r\n")) assert(Buffer.byteLength(line) <= 75, "75-octet physical lines");
  const dates = events(result.text).map((event) => {
    const date = property(event, "DTSTART;VALUE=DATE");
    const ymd = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    const reading = schedule.resolveReading(plan, ymd);
    assert.equal(reading.kind, "reading");
    assert(ymd >= result.start && ymd <= result.end);
    assert.equal(property(event, "DTEND;VALUE=DATE"), schedule.addDaysYmd(ymd, 1).replace(/-/g, ""));
    assert.equal(property(event, "SUMMARY"), `ChristoDay: ${reading.fullRef}`);
    assert.equal(property(event, "DTSTAMP"), "20261013T163000Z");
    assert.equal(property(event, "TRANSP"), "TRANSPARENT");
    const url = new URL(property(event, "URL"));
    assert.equal(url.origin, "https://alphaeusng.github.io");
    assert.equal(url.pathname, "/ChristoDay/");
    assert.deepEqual([...url.searchParams.keys()], ["d", "tr"]);
    assert.equal(url.searchParams.get("d"), ymd);
    assert.equal(url.searchParams.get("tr"), "ESV");
    return ymd;
  });
  const expected = Array.from({ length: 28 }, (_, offset) => schedule.addDaysYmd(result.start, offset))
    .filter((date) => schedule.resolveReading(plan, date).kind === "reading");
  assert.deepEqual(dates, expected);
  assert.equal(new Set(events(result.text).map((event) => property(event, "UID"))).size, 20);
  assert.doesNotMatch(result.text, /VALARM|RRULE|VJOURNAL|COMPLETED:/);
}

const first = calendar.build(plan, "2026-06-15", "WEB", now);
const repeat = calendar.build(plan, "2026-06-15", "WEB", new Date("2026-10-14T12:00:00Z"));
assert.deepEqual(events(first.text).map((event) => property(event, "UID")), events(repeat.text).map((event) => property(event, "UID")));
assert.match(unfold(first.text), /SUMMARY:ChristoDay: Jude 1:1-25/);
assert.match(unfold(first.text), /SUMMARY:ChristoDay: Jude 1:1-4/);
assert.match(unfold(calendar.build(plan, "2026-06-15", "invalid", now).text), /tr=WEB/);
for (const invalid of ["2026-02-30", "bad", "9999-12-04"]) assert.throws(() => calendar.build(plan, invalid));
assert.throws(() => calendar.build(null, "2026-06-15"));

const special = structuredClone(plan);
special.books.jude.label = '愛😀,;\\\nBEGIN:VEVENT\r\nSUMMARY:injected' + '愛😀'.repeat(35);
const escaped = calendar.build(special, "2026-06-15", "WEB", now).text;
assert.equal(events(escaped).length, 20, "newlines cannot inject properties or events");
const summary = property(events(escaped)[0], "SUMMARY");
assert(summary.includes('愛😀\\,\\;\\\\\\nBEGIN:VEVENT\\nSUMMARY:injected'), "iCalendar text escapes all separators");
assert(summary.endsWith('愛😀'.repeat(35) + ' 1:1-25'), "UTF-8 characters survive folding");
for (const line of escaped.split("\r\n")) {
  assert(Buffer.byteLength(line) <= 75);
  assert.equal(line.includes("\ufffd"), false);
}

console.log("test-calendar.mjs: date windows, schedule/rotation, RFC properties, escaping, UTF-8 folding, stable identity and input limits passed");
