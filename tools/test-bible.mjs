import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "js/bible.js"), "utf8");

function loadBible(fetchImpl, timers = {}) {
  const sandbox = {
    AbortController,
    clearTimeout: timers.clearTimeout || clearTimeout,
    console,
    fetch: fetchImpl,
    setTimeout: timers.setTimeout || setTimeout,
    window: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.ChristoBible;
}

{
  let request;
  const bible = loadBible(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [{ verse: 1, text: "In the beginning" }] };
  });
  const chapter = await bible.fetchChapter("NIV", 40, 1);
  assert.equal(chapter.length, 1);
  assert.match(request.url, /\/NIV\/40\/1\/$/);
  assert.equal(request.options.mode, "cors");
  assert(request.options.signal instanceof AbortSignal);
}

{
  const bible = loadBible(async () => ({ ok: false, status: 503 }));
  await assert.rejects(() => bible.fetchChapter("NIV", 40, 1), /Bible fetch failed \(503\)/);
}

{
  const bible = loadBible(async () => ({ ok: true, json: async () => null }));
  await assert.rejects(
    () => bible.fetchChapter("NIV", 40, 1),
    /Bible API returned invalid chapter data/
  );
}

{
  const bible = loadBible(async () => ({
    ok: true,
    json: async () => ({
      verses: [null, { verse: "2", text: "Valid" }, { verse: 0, text: "Invalid" }],
    }),
  }));
  assert.deepEqual(JSON.parse(JSON.stringify(await bible.fetchChapter("NIV", 40, 1))), [
    { verse: 2, text: "Valid" },
  ]);
}

{
  let cleared = false;
  const bible = loadBible(
    async (_url, options) => {
      assert(options.signal.aborted);
      throw new DOMException("aborted", "AbortError");
    },
    {
      setTimeout(callback) {
        callback();
        return 7;
      },
      clearTimeout(id) {
        assert.equal(id, 7);
        cleared = true;
      },
    }
  );
  await assert.rejects(() => bible.fetchChapter("NIV", 40, 1), /Bible fetch timed out/);
  assert(cleared);
}

{
  const bible = loadBible(async () => ({
    ok: true,
    json: async () => [
      { verse: 1, text: "<i>Before</i>" },
      { verse: 2, text: "Jesus &amp; disciples" },
      { verse: 3, text: "After" },
    ],
  }));
  const passage = await bible.fetchPassage("matthew", "1:1-2", "UNKNOWN");
  assert.equal(passage.translation, "NIV");
  assert.equal(passage.text, "Before Jesus & disciples");
  assert.match(passage.html, /Jesus &amp; disciples/);
  assert.equal(passage.verses.length, 2);
}

{
  let fetchCount = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const bible = loadBible(async () => {
    fetchCount++;
    await pending;
    return { ok: true, json: async () => [{ verse: 1, text: "Shared" }] };
  });
  const first = bible.fetchChapter("NIV", 40, 1);
  const second = bible.fetchChapter("NIV", 40, 1);
  assert.equal(fetchCount, 1);
  release();
  assert.deepEqual(await first, await second);
  await bible.fetchChapter("NIV", 40, 1);
  assert.equal(fetchCount, 1);
}

{
  let fetchCount = 0;
  const bible = loadBible(async () => {
    fetchCount++;
    if (fetchCount === 1) throw new Error("temporary failure");
    return { ok: true, json: async () => [] };
  });
  await assert.rejects(() => bible.fetchChapter("NIV", 40, 1), /temporary failure/);
  await bible.fetchChapter("NIV", 40, 1);
  assert.equal(fetchCount, 2);
}

{
  let fetchCount = 0;
  const bible = loadBible(async () => {
    fetchCount++;
    return { ok: true, json: async () => [] };
  });
  for (let chapter = 1; chapter <= bible.MAX_CACHED_CHAPTERS + 1; chapter++) {
    await bible.fetchChapter("NIV", 40, chapter);
  }
  await bible.fetchChapter("NIV", 40, 1);
  assert.equal(fetchCount, bible.MAX_CACHED_CHAPTERS + 2);
}

console.log("test-bible.mjs: 9 network, payload, cache, and passage cases ok");
