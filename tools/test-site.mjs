import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function localReferences(file) {
  const source = readFileSync(join(root, file), "utf8");
  return [...source.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((ref) => !/^(?:https?:|mailto:|#|data:)/.test(ref))
    .map((ref) => ref.split(/[?#]/, 1)[0]);
}

for (const htmlFile of ["index.html", "404.html"]) {
  for (const reference of localReferences(htmlFile)) {
    const target = normalize(join(root, dirname(htmlFile), reference));
    assert(existsSync(target), `${htmlFile} references missing ${reference}`);
  }
}

const worker = readFileSync(join(root, "sw.js"), "utf8");
assert.match(worker, /const CACHE_PREFIX = "christoday-";/, "service worker owns a cache prefix");
assert.match(
  worker,
  /\.filter\(\(k\) => k\.startsWith\(CACHE_PREFIX\) && k !== CACHE\)/,
  "activation must delete only obsolete ChristoDay caches",
);
assert.match(
  worker,
  /new URL\(self\.registration\.scope\)/,
  "runtime caching must derive the installed ChristoDay scope",
);
assert.match(
  worker,
  /url\.pathname\.startsWith\([^)]*\.pathname\)/,
  "runtime caching must reject same-origin paths outside the installed scope",
);
assert.doesNotMatch(
  worker,
  /caches\.match\(req\)/,
  "runtime cache reads must not search caches owned by other projects",
);
assert.match(
  worker,
  /event\.waitUntil\(networkPromise/,
  "runtime cache writes must extend the fetch event lifetime",
);
assert.match(worker, /req\.mode === "navigate"/, "document navigations need a dedicated offline path");
assert.match(
  worker,
  /fetch\(req\)\.catch\(\(\) =>[\s\S]{0,120}cache\.match\(SHELL_URL\)/,
  "document navigations must stay network-first and fall back to the canonical shell",
);
const precacheBlock = /const PRECACHE = \[([\s\S]*?)\];/.exec(worker)?.[1];
assert(precacheBlock, "service worker must declare PRECACHE");
const precache = [...precacheBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
for (const reference of precache) {
  const target = normalize(join(root, reference));
  assert(existsSync(target), `PRECACHE references missing ${reference}`);
}

const requiredRuntime = [
  "./js/version.js",
  "./js/schedule.js",
  "./js/red-letter.js",
  "./js/bible.js",
  "./js/state.js",
  "./js/reading-actions.js",
  "./js/journal-backup.js",
  "./js/ref-popover.js",
  "./js/journal-history.js",
  "./js/offline-readings.js",
  "./js/today-rollover.js",
  "./js/app.js",
  "./data/segments.json",
];
for (const reference of requiredRuntime) {
  assert(precache.includes(reference), `PRECACHE omits runtime file ${reference}`);
}

const index = readFileSync(join(root, "index.html"), "utf8");
const planPreloadIndex = index.indexOf('rel="preload" href="data/segments.json"');
const biblePreconnectIndex = index.indexOf('rel="preconnect" href="https://bolls.life"');
const workerRegistrationIndex = index.indexOf('navigator.serviceWorker.register("./sw.js")');
const stylesheetIndex = index.indexOf('rel="stylesheet" href="css/style.css"');
assert(planPreloadIndex >= 0, "reading plan must be preloaded");
assert(biblePreconnectIndex >= 0, "Bible API connection must be warmed early");
assert(workerRegistrationIndex >= 0, "service worker must be registered");
assert(
  planPreloadIndex < stylesheetIndex &&
    biblePreconnectIndex < stylesheetIndex &&
    workerRegistrationIndex < stylesheetIndex,
  "plan preload, Bible API connection, and offline-shell install must start before render-blocking styles",
);
assert.doesNotMatch(
  index,
  /addEventListener\("load"[\s\S]{0,160}serviceWorker\.register/,
  "service-worker registration must not wait for the full page load",
);
assert(
  index.indexOf('src="js/red-letter.js"') < index.indexOf('src="js/bible.js"'),
  "red-letter.js must load before bible.js"
);
assert(
  index.indexOf('src="js/state.js"') < index.indexOf('src="js/app.js"'),
  "state.js must load before app.js"
);
assert.match(index, /class="top-nav"[^>]*>\s*<a href="#about">About<\/a>\s*<\/nav>/, "desktop top-nav keeps About only");
assert.doesNotMatch(index, /class="hero"/, "first screen must not keep a hero manifesto");
assert.match(index, /id="date-pick"/, "toolbar date picker remains");
assert.match(index, /id="translation"/, "toolbar translation select remains");
assert.match(index, /id="reading-panel"/, "reading panel id remains");
assert.match(index, /id="ref-popover"/, "reference popover remains");
const css = readFileSync(join(root, "css/style.css"), "utf8");
assert.match(css, /\.passage-body \.wj/, "words of Jesus are styled in red");
assert.match(css, /\.ref-popover/, "reference popover styles remain");
assert.match(
  readFileSync(join(root, "js/bible.js"), "utf8"),
  /ChristoRedLetter/,
  "Bible client uses red-letter speaker boundaries"
);
assert.match(index, /id="fatal"/, "fatal recovery id remains");
assert.match(index, /id="weekend-panel"/, "weekend panel id remains");
assert.match(index, /id="btn-preview-monday"/, "preview Monday control remains");
assert.match(index, /id="btn-copy"/, "copy passage control remains");
assert.match(index, /id="btn-listen"/, "listen passage control remains");
assert.match(index, /id="btn-share"/, "share reading control remains");
assert.match(index, /id="btn-type-smaller"/, "smaller passage text control remains");
assert.match(index, /id="btn-type-larger"/, "larger passage text control remains");
assert.match(index, /id="btn-backup"/, "journal backup download control remains");
assert.match(index, /id="btn-restore"/, "journal backup restore control remains");
assert.match(index, /id="backup-file"[^>]*accept="application\/json,\.json"/, "restore accepts JSON backup files");
assert.match(index, /id="backup-status"[^>]*role="status"/, "backup outcomes are announced");
assert.match(index, /id="action-status"[^>]*role="status"/, "copy/share status is announced");
assert.match(index, /id="passage-body"[^>]*aria-busy="true"[^>]*inert/, "passage starts busy and inert before live text settles");
assert.match(index, /id="journal-history"/, "journal history stays on the page");
assert.match(index, /id="history-query"/, "journal history has a local text search");
assert.match(index, /id="history-book"/, "journal history can filter by book");
assert.match(index, /id="history-from"/, "journal history can filter from a date");
assert.match(index, /id="history-to"/, "journal history can filter to a date");
assert.match(index, /id="btn-save-reading"/, "permitted readings can be saved for offline");
assert.match(index, /id="btn-remove-reading"/, "saved readings can be removed");
assert.match(index, /id="passage-availability"/, "offline availability is visible per reading");
assert.match(index, /id="btn-focus"/, "reading focus mode can be toggled");
assert.match(index, /id="btn-leading-tighter"/, "line spacing can be tightened");
assert.match(index, /id="btn-leading-looser"/, "line spacing can be loosened");
assert.match(index, /id="reading-tools"/, "secondary reading tools can fold");
assert.match(css, /html\[data-reading-focus="on"\] \.passage-body/, "focus mode keeps a comfortable passage measure");
assert.match(css, /max-width:\s*65ch/, "focus mode limits line width");
assert.match(css, /--passage-leading/, "line spacing uses the passage leading token");
assert.match(css, /\.history-result/, "journal history results are styled for touch");
assert.match(css, /flex-wrap:\s*wrap/, "narrow toolbars wrap instead of overflowing");
for (const script of [
  "js/reading-actions.js",
  "js/journal-backup.js",
  "js/ref-popover.js",
  "js/journal-history.js",
  "js/offline-readings.js",
  "js/today-rollover.js",
]) {
  assert(
    index.indexOf(`src="${script}"`) > index.indexOf('src="js/state.js"') &&
      index.indexOf(`src="${script}"`) < index.indexOf('src="js/app.js"'),
    `${script} must load after state and before app`
  );
}

const app = readFileSync(join(root, "js/app.js"), "utf8");
const actions = readFileSync(join(root, "js/reading-actions.js"), "utf8");
const backup = readFileSync(join(root, "js/journal-backup.js"), "utf8");
const popover = readFileSync(join(root, "js/ref-popover.js"), "utf8");
const history = readFileSync(join(root, "js/journal-history.js"), "utf8");
const readings = readFileSync(join(root, "js/offline-readings.js"), "utf8");
const today = readFileSync(join(root, "js/today-rollover.js"), "utf8");
assert.match(app, /fetch\("data\/segments\.json"\)/, "app must reuse the preloaded plan response");
assert.doesNotMatch(
  app,
  /fetch\("data\/segments\.json",\s*\{[^}]*cache:\s*"no-cache"/,
  "plan fetch must not bypass the preload or browser cache",
);
const planValidationIndex = app.indexOf("ChristoSchedule.validatePlan(candidatePlan)");
const planAssignmentIndex = app.indexOf("plan = candidatePlan");
assert(planValidationIndex >= 0, "app.js must validate fetched plan data");
assert(
  planAssignmentIndex > planValidationIndex,
  "app.js must validate fetched plan data before runtime assignment",
);
const passageRequestIndex = app.indexOf("signal: controller.signal");
const previousAbortIndex = app.indexOf("previousController?.abort()", passageRequestIndex);
assert(passageRequestIndex >= 0, "app.js must pass an AbortSignal to passage requests");
assert(
  previousAbortIndex > passageRequestIndex,
  "app.js must subscribe the new passage before aborting the previous consumer"
);
assert.match(app, /prefetchNextReading\(reading, tr, seq\)/, "next weekday must prefetch after the current passage paints");
assert.match(app, /previousPrefetchController\?\.abort\(\)/, "navigation must cancel obsolete next-day prefetch consumers");
assert.match(app, /params\.get\("d"\)/, "boot must read the d deep-link");
assert.match(app, /params\.get\("tr"\)/, "boot must read the tr deep-link");
assert.match(app, /history\.replaceState/, "date/translation changes must update the URL");
assert.match(actions, /navigator\.share/, "share must prefer the Web Share API");
assert.match(actions, /clipboard\.writeText/, "copy/share must write to the clipboard");
assert.match(actions, /speechSynthesis/, "listen must use the Web Speech API");
assert.match(actions, /speechRun/, "stale speech callbacks must not own a replacement reading");
assert.match(app, /key === "l"/, "L reads the visible passage aloud");
assert.match(actions, /shiftPassageSize/, "passage size can be changed from the reader");
assert.match(actions, /data-passage-size/, "passage size is applied on the document");
assert.match(actions, /data-reading-focus/, "focus mode uses the document attribute");
assert.match(actions, /data-line-spacing/, "line spacing is applied on the document");
assert.match(app, /setPassagePending\(true\)/, "passage actions are suspended while text updates");
assert.match(app, /body\.toggleAttribute\("inert", pending\)/, "retained stale Scripture is not interactive while updating");
assert.match(backup, /ChristoState\.createBackup\(state,\s*undefined,\s*currentYmd\)/, "journal backup records the current reading date");
assert.match(backup, /ChristoState\.parseBackup/, "journal restore validates before applying state");
assert.match(backup, /window\.confirm/, "journal restore confirms before replacing local data");
assert.match(backup, /ChristoState\.restoreOpenYmd/, "journal restore selects a backed-up weekday when valid");
assert.match(
  backup,
  /restoreOpenYmd\([\s\S]*kind === "reading"[\s\S]*renderDay\(openYmd\)/,
  "confirmed restore opens a valid backed-up weekday and updates the URL"
);
assert.match(popover, /fn-mark/, "cross-reference markers still open the popover");
assert.match(popover, /class="wj"|xref-link/, "popover still follows passage reference links");
assert.match(history, /searchEntries/, "journal history filters on device");
assert.doesNotMatch(history, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/, "journal search never uploads notes");
assert.match(readings, /allowsLocalPassageStorage/, "offline copies follow the translation permission gate");
assert.match(app, /decideTodayRollover/, "a Singapore day change is handled without a reload");
assert.match(today, /editingHistorical/, "an active historical note is not moved at midnight");
assert.match(
  app.slice(app.indexOf("function toggleComplete"), app.indexOf("function updateCompleteButton")),
  /ensureDay\(currentYmd\)/,
  "completion stays on the open reading date"
);

console.log(
  `test-site.mjs: local references valid; ${precache.length} precache entries verified`
);
