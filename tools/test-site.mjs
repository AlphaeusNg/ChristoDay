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
  "./js/bible.js",
  "./js/state.js",
  "./js/app.js",
  "./data/segments.json",
];
for (const reference of requiredRuntime) {
  assert(precache.includes(reference), `PRECACHE omits runtime file ${reference}`);
}

const index = readFileSync(join(root, "index.html"), "utf8");
assert(
  index.indexOf('src="js/state.js"') < index.indexOf('src="js/app.js"'),
  "state.js must load before app.js"
);

console.log(
  `test-site.mjs: local references valid; ${precache.length} precache entries verified`
);
