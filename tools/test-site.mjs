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
  "./js/reading-calendar.js",
  "./js/reading-checklist.js",
  "./js/more-menu.js",
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

const rawIndex = readFileSync(join(root, "index.html"), "utf8");
const versionId = /id: "([^"]+)"/.exec(readFileSync(join(root, "js/version.js"), "utf8"))[1];
const index = rawIndex.replaceAll(`?v=${versionId}`, "");
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
assert.match(index, /id="passage-availability"/, "offline availability exists per reading");
assert.match(index, /id="btn-focus"/, "reading focus mode can be toggled");
assert.match(index, /id="btn-leading-tighter"/, "line spacing can be tightened");
assert.match(index, /id="btn-leading-looser"/, "line spacing can be loosened");
assert.doesNotMatch(index, /fold-toggle|id="reading-tools"|id="offline-tools"|reading-tools-panel/, "fold toggles are removed");
assert.doesNotMatch(index, /\bicon-btn\b/, "markup uses the shared icon-button class");
assert.doesNotMatch(css, /\.icon-btn\b/, "styles use the shared icon-button class");
assert.match(css, /--icon-btn-size:\s*32px;\s*--icon-btn-radius:\s*8px;\s*--icon-size:\s*18px;\s*--icon-stroke:\s*1\.75;\s*--icon-btn-target:\s*44px;\s*--icon-btn-gap:\s*4px;/, "shared icon-button tokens");
assert.match(css, /\.btn\.icon-button\s*\{[^}]*width:\s*var\(--icon-btn-size\);[^}]*min-width:\s*var\(--icon-btn-size\);[^}]*height:\s*var\(--icon-btn-size\);[^}]*min-height:\s*var\(--icon-btn-size\);[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*border-radius:\s*var\(--icon-btn-radius\);[^}]*background:\s*transparent;[^}]*color:\s*var\(--muted\);/, "icon buttons are quiet 32px squares");
assert.match(css, /\.btn\.icon-button:hover,\s*\.btn\.icon-button:focus-visible\s*\{[^}]*background:\s*rgba\(148,\s*163,\s*184,\s*0\.12\);[^}]*color:\s*var\(--text\);/, "icon button hover and focus are subtle");
assert.match(css, /\.btn\.icon-button svg,\s*\.menu-item svg\s*\{[^}]*width:\s*var\(--icon-size\);[^}]*height:\s*var\(--icon-size\);[^}]*stroke-width:\s*var\(--icon-stroke\);/, "icon glyphs are 18px");
assert.match(css, /#btn-complete\.icon-button\s*\{[^}]*border:\s*1px solid var\(--gold-line\);[^}]*background:\s*transparent;[^}]*color:\s*var\(--gold\);/, "mark complete is a gold outline");
assert.match(css, /#btn-complete\.icon-button\.is-done,\s*#btn-complete\.icon-button\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--gold\);[^}]*color:\s*#18150d;/, "completed days fill the mark-complete button");
assert.match(index, /class="btn icon-button more-menu-btn" id="btn-more"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*data-tip="More options"/, "more options uses the shared icon button");
assert.match(index, /id="btn-more"[^>]*>\s*<svg viewBox="0 0 24 24"[^>]*>\s*(?:<circle [^>]*\/>\s*){3}<\/svg>/, "more button uses a three-dot icon");
assert.doesNotMatch(index, /⋯|☐/, "no unicode glyph icons");
assert.match(index, /class="card-head">\s*<span class="badge" id="book-badge">/, "book badge leads the reading header");
assert.match(index, /id="btn-focus"[^>]*aria-pressed="false"[^>]*data-menu-stay/, "focus stays available inside the menu");
assert.match(index, /id="include-share-note"[^>]*aria-pressed="false"[^>]*data-menu-stay/, "include-note stays a pressed toggle");
assert.match(index, /id="btn-type-larger"[^>]*data-menu-stay/, "text size steppers keep the menu open");
assert.match(index, /id="btn-leading-looser"[^>]*data-menu-stay/, "line spacing steppers keep the menu open");
const moreMenu = readFileSync(join(root, "js/more-menu.js"), "utf8");
assert.match(moreMenu, /attributeFilter:\s*\["hidden"\]/, "overflow follows visible day panels");
assert.match(moreMenu, /menu-reading-only/, "reading tools hide on weekend and pre-start cards");
assert.match(moreMenu, /data-menu-stay/, "toggles and steppers can keep the menu open");
assert.match(index, /id="more-menu-list"[^>]*role="menu"/, "overflow menu lists reading, checklist, and calendar actions");
assert.doesNotMatch(index, /id="reading-checklist"/, "checklist is not a separate card");
assert.doesNotMatch(index, /id="reading-calendar"/, "calendar download is not a separate card");
assert.match(css, /\.more-menu\s*\{[^}]*position:\s*relative/, "reading overflow sits in the button row");
assert.match(css, /\.weekend-card > \.more-menu\s*\{[^}]*position:\s*absolute/, "weekend overflow anchors to the card");
assert.match(css, /#more-menu-list\s*\{[^}]*position:\s*absolute/, "overflow menu drops down from the day card");
assert.match(css, /@media print[\s\S]*\.more-menu\s*\{[^}]*display:\s*none/, "overflow menu stays off the printed checklist");
assert.doesNotMatch(
  readFileSync(join(root, "js/reading-checklist.js"), "utf8"),
  /#reading-checklist(?!-)/,
  "checklist refresh must not toggle a removed card"
);
assert.doesNotMatch(
  readFileSync(join(root, "js/reading-calendar.js"), "utf8"),
  /#reading-calendar/,
  "calendar refresh must not toggle a removed card"
);
assert.match(css, /html\[data-reading-focus="on"\] \.passage-body/, "focus mode keeps a comfortable passage measure");
assert.match(css, /max-width:\s*65ch/, "focus mode limits line width");
assert.match(css, /--passage-leading/, "line spacing uses the passage leading token");
assert.match(css, /\.history-result/, "journal history results are styled for touch");
assert.match(css, /flex-wrap:\s*wrap/, "narrow toolbars wrap instead of overflowing");
for (const script of [
  "js/reading-actions.js",
  "js/journal-backup.js",
  "js/reading-calendar.js",
  "js/reading-checklist.js",
  "js/more-menu.js",
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

const primaryStart = index.indexOf('class="reading-primary"');
const menuListStart = index.indexOf('id="more-menu-list"');
assert(primaryStart >= 0 && menuListStart > primaryStart, "reading row precedes the overflow menu");
const primarySlice = index.slice(primaryStart, menuListStart);
assert.equal((primarySlice.match(/<button /g) || []).length, 3, "reading row shows Listen, Mark complete, and More options");
for (const id of ["btn-listen", "btn-complete", "btn-more"]) {
  assert.match(primarySlice, new RegExp(`id="${id}"`), `${id} stays in the reading row`);
}
assert.doesNotMatch(primarySlice, /id="btn-focus"|id="btn-copy"|fold-toggle/, "reading tools are not inline in the header");
const menuSlice = index.slice(menuListStart, index.indexOf('id="action-status"'));
for (const id of ["btn-focus", "btn-copy", "btn-share", "include-share-note", "btn-type-smaller", "btn-type-larger", "btn-leading-tighter", "btn-leading-looser", "passage-availability", "btn-save-reading", "btn-remove-reading", "btn-checklist", "btn-calendar"]) {
  assert.match(menuSlice, new RegExp(`id="${id}"`), `${id} stays in the overflow menu`);
}
assert.match(menuSlice, /Text &amp; share tools/, "text tools are grouped in the menu");
assert.match(menuSlice, /Offline reading/, "offline tools are grouped in the menu");
assert.match(menuSlice, /Print &amp; calendar/, "print and calendar are grouped in the menu");
assert.match(css, /\.card-head\s*\{[^}]*flex-wrap:\s*nowrap/, "book badge and reading controls stay on one line");
assert.match(css, /\.reading-primary\s*\{[^}]*flex-wrap:\s*nowrap/, "primary controls never wrap");

const assetReferences = [...rawIndex.matchAll(/(?:src|href)="((?:js\/[^"?]+\.js|css\/style\.css)\?v=([^"&]+))"/g)];
assert.equal(assetReferences.length, 16, "every local CSS/JS reference must have a version");
for (const [, , version] of assetReferences) assert.equal(version, versionId);
