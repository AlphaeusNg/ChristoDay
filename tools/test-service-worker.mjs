import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "sw.js"), "utf8");
const scope = "https://alphaeusng.github.io/ChristoDay/";

function createWorker({
  cachedBody = null,
  networkBody = "network",
  networkStatus = 200,
  networkFails = false,
  putFails = false,
} = {}) {
  const listeners = new Map();
  const calls = { fetch: [], match: [], open: [], put: [] };
  const cache = {
    async addAll() {},
    async match(request) {
      calls.match.push(request.url);
      return cachedBody == null ? undefined : new Response(cachedBody);
    },
    async put(request, response) {
      calls.put.push({ url: request.url, body: await response.text() });
      if (putFails) throw new Error("cache write denied");
    },
  };
  const self = {
    SITE_VERSION: { id: "test" },
    registration: { scope },
    location: new URL(scope),
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  const context = {
    URL,
    Promise,
    Response,
    self,
    importScripts() {},
    caches: {
      async open(name) {
        calls.open.push(name);
        return cache;
      },
      async keys() {
        return [];
      },
      async delete() {
        return true;
      },
    },
    async fetch(request) {
      calls.fetch.push(request.url);
      if (networkFails) throw new Error("offline");
      return new Response(networkBody, { status: networkStatus });
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "sw.js" });

  function dispatchFetch(url) {
    const responsePromises = [];
    const lifetimePromises = [];
    listeners.get("fetch")({
      request: { method: "GET", url },
      respondWith(promise) {
        responsePromises.push(Promise.resolve(promise));
      },
      waitUntil(promise) {
        lifetimePromises.push(Promise.resolve(promise));
      },
    });
    return { responsePromises, lifetimePromises };
  }

  return { calls, dispatchFetch };
}

{
  const worker = createWorker();
  const event = worker.dispatchFetch("https://alphaeusng.github.io/VerseKeep/");
  assert.equal(event.responsePromises.length, 0, "out-of-scope requests are not intercepted");
  assert.equal(event.lifetimePromises.length, 0, "out-of-scope requests create no worker work");
  assert.equal(worker.calls.fetch.length, 0, "out-of-scope requests bypass worker fetch");
}

{
  const worker = createWorker({ networkBody: "fresh" });
  const event = worker.dispatchFetch(`${scope}docs/NICHE.md`);
  assert.equal(event.responsePromises.length, 1, "in-scope GET receives a worker response");
  assert.equal(event.lifetimePromises.length, 1, "runtime update extends the fetch lifetime synchronously");
  const response = await event.responsePromises[0];
  await event.lifetimePromises[0];
  assert.equal(await response.text(), "fresh", "an uncached request returns its network response");
  assert.deepEqual(worker.calls.open, ["christoday-test"], "only the current owned cache is opened");
  assert.equal(worker.calls.match.length, 1, "the current owned cache is checked once");
  assert.equal(worker.calls.put.length, 1, "a successful network response is cached");
}

{
  const worker = createWorker({ cachedBody: "offline copy", networkFails: true });
  const event = worker.dispatchFetch(`${scope}js/app.js`);
  const response = await event.responsePromises[0];
  await event.lifetimePromises[0];
  assert.equal(await response.text(), "offline copy", "network failure falls back to the owned cache");
}

{
  const worker = createWorker({ cachedBody: "valid cached plan", networkBody: "missing", networkStatus: 404 });
  const event = worker.dispatchFetch(`${scope}data/segments.json`);
  const response = await event.responsePromises[0];
  assert.equal(response.status, 404, "a non-200 plan response must reach the app");
  assert.equal(await response.text(), "missing", "a cached plan must not mask a non-200 response");
  assert.equal(worker.calls.match.length, 0, "online plan requests must not read the cache first");
  assert.equal(worker.calls.put.length, 0, "runtime plan responses must not replace the offline plan");
}

{
  const invalidPlan = '{"books":{}}';
  const worker = createWorker({ cachedBody: "valid cached plan", networkBody: invalidPlan });
  const event = worker.dispatchFetch(`${scope}data/segments.json`);
  const response = await event.responsePromises[0];
  assert.equal(await response.text(), invalidPlan, "an invalid 200 plan payload must reach app validation");
  assert.equal(worker.calls.match.length, 0, "online invalid plans must not fall back to cache");
}

{
  const worker = createWorker({ cachedBody: "offline plan", networkFails: true });
  const event = worker.dispatchFetch(`${scope}data/segments.json`);
  const response = await event.responsePromises[0];
  assert.equal(await response.text(), "offline plan", "a rejected plan fetch uses the install-time copy");
  assert.equal(worker.calls.match.length, 1, "offline plan fallback checks the current owned cache");
}

{
  const worker = createWorker({ networkBody: "still usable", putFails: true });
  const event = worker.dispatchFetch(`${scope}docs/NICHE.md`);
  const response = await event.responsePromises[0];
  await event.lifetimePromises[0];
  assert.equal(
    await response.text(),
    "still usable",
    "cache-write failure must not discard a valid network response",
  );
}

console.log("test-service-worker.mjs: scope, plan freshness, fallback, lifetime, and write-failure cases passed");
