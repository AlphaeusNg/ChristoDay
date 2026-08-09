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

console.log("test-bible.mjs: 4 network and passage cases ok");
