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
  "./js/app.js",
  "./data/segments.json",
];
for (const reference of requiredRuntime) {
  assert(precache.includes(reference), `PRECACHE omits runtime file ${reference}`);
}

const index = readFileSync(join(root, "index.html"), "utf8");
const planPreloadIndex = index.indexOf('rel="preload" href="data/segments.json"');
const workerRegistrationIndex = index.indexOf('navigator.serviceWorker.register("./sw.js")');
const stylesheetIndex = index.indexOf('rel="stylesheet" href="css/style.css"');
assert(planPreloadIndex >= 0, "reading plan must be preloaded");
assert(workerRegistrationIndex >= 0, "service worker must be registered");
assert(
  planPreloadIndex < stylesheetIndex && workerRegistrationIndex < stylesheetIndex,
  "plan preload and offline-shell install must start before render-blocking styles",
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
assert.match(index, /id="action-status"[^>]*role="status"/, "copy/share status is announced");

const app = readFileSync(join(root, "js/app.js"), "utf8");
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
assert.match(app, /params\.get\("d"\)/, "boot must read the d deep-link");
assert.match(app, /params\.get\("tr"\)/, "boot must read the tr deep-link");
assert.match(app, /history\.replaceState/, "date/translation changes must update the URL");
assert.match(app, /navigator\.share/, "share must prefer the Web Share API");
assert.match(app, /clipboard\.writeText/, "copy/share must write to the clipboard");
assert.match(app, /speechSynthesis/, "listen must use the Web Speech API");
assert.match(app, /key === "l"/, "L reads the visible passage aloud");
assert.match(app, /shiftPassageSize/, "passage size can be changed from the reader");
assert.match(app, /data-passage-size/, "passage size is applied on the document");

console.log(
  `test-site.mjs: local references valid; ${precache.length} precache entries verified`
);
