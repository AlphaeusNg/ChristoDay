import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const redLetterSource = readFileSync(join(root, "js/red-letter.js"), "utf8");
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
  vm.runInContext(redLetterSource, sandbox);
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
  assert.match(passage.html, /<i>Before<\/i>/);
  assert.equal(passage.verses.length, 2);
}

{
  const bible = loadBible(async () => ({ ok: true, json: async () => [] }));
  const temptation = bible.wrapWordsOfJesus(
    "The tempter said, \u201cIf you are the Son of God, tell these stones to become bread.\u201d",
    "matthew",
    4,
    3
  );
  assert.doesNotMatch(temptation, /class="wj"/, "the tempter's quotation must not be red");
  const reply = bible.wrapWordsOfJesus(
    "Jesus answered, <i>\u201cIt is written: Man shall not live on bread alone.\u201d</i>",
    "matthew",
    4,
    4
  );
  assert.match(reply, /Jesus answered, <i><span class="wj">\u201cIt is written:/);
  assert.match(reply, /<\/span><\/i>$/);
  const continued = bible.wrapWordsOfJesus(
    "for theirs is the kingdom of heaven.",
    "matthew",
    5,
    4
  );
  assert.match(continued, /^<span class="wj">for theirs is the kingdom of heaven\.<\/span>$/);
  const closingVerse = bible.wrapWordsOfJesus(
    '<i>and whoever loses their life for my sake will find it.\u201d</i> The disciples listened.',
    "matthew",
    10,
    39
  );
  assert.match(closingVerse, /^<span class="wj"><i>.*\u201d<\/i><\/span> The disciples listened\.$/);
}

{
  const bible = loadBible(async () => ({
    ok: true,
    json: async () => [
      {
        verse: 3,
        text: "The Beatitudes<br/>\u201cBlessed are the poor in spirit",
        comment: "<a href='/NKJV/20/16/19'>Prov. 16:19</a>",
      },
    ],
  }));
  const passage = await bible.fetchPassage("matthew", "5:3", "NKJV");
  assert.match(passage.html, /class="section-head"/);
  assert.match(passage.html, /The Beatitudes/);
  assert.match(passage.html, /class="wj"/);
  assert.match(passage.html, /class="fn-mark"/);
  assert.match(passage.verses[0].commentHtml, /data-ref="NKJV\/20\/16\/19"/);
  assert.match(passage.verses[0].commentHtml, /Prov\. 16:19/);
  assert.match(passage.html, /<button type="button" class="vnum"/);
}

{
  const bible = loadBible(async () => ({ ok: true, json: async () => [] }));
  const comment = bible.rewriteCommentHtml(
    '<button onclick="alert(1)">unsafe</button> <a href="/ESV/43/3/16" onclick="alert(2)">John 3:16</a>'
  );
  assert.doesNotMatch(comment, /onclick|alert\(/);
  assert.match(comment, /data-ref="ESV\/43\/3\/16"/);
}

{
  const parsed = loadBible(async () => ({ ok: true, json: async () => [] })).parseRemoteRef(
    "NKJV/40/14/23"
  );
  assert.equal(parsed.bookId, 40);
  assert.equal(parsed.chapter, 14);
  assert.equal(parsed.verseFrom, 23);
  assert.equal(parsed.label, "Matthew 14:23");
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

{
  let releaseRequest;
  let underlyingSignal;
  const bible = loadBible((_url, options) => {
    underlyingSignal = options.signal;
    return new Promise((resolve, reject) => {
      releaseRequest = () => resolve({
        ok: true,
        json: async () => [{ verse: 1, text: "Shared after navigation" }],
      });
      options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  });
  const oldController = new AbortController();
  const newController = new AbortController();
  const oldConsumer = bible.fetchChapter("NIV", 40, 1, bible.FETCH_TIMEOUT_MS, oldController.signal);
  const newConsumer = bible.fetchChapter("NIV", 40, 1, bible.FETCH_TIMEOUT_MS, newController.signal);
  oldController.abort();
  await assert.rejects(() => oldConsumer, /Bible fetch cancelled/);
  assert.equal(underlyingSignal.aborted, false, "a surviving consumer keeps the shared fetch alive");
  releaseRequest();
  assert.equal((await newConsumer)[0].text, "Shared after navigation");
}

{
  let fetchCount = 0;
  let firstSignal;
  const bible = loadBible(async (_url, options) => {
    fetchCount++;
    if (fetchCount === 1) {
      firstSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });
    }
    return { ok: true, json: async () => [{ verse: 1, text: "Retry" }] };
  });
  const controller = new AbortController();
  const obsolete = bible.fetchChapter("NIV", 40, 1, bible.FETCH_TIMEOUT_MS, controller.signal);
  controller.abort();
  await assert.rejects(() => obsolete, /Bible fetch cancelled/);
  assert.equal(firstSignal.aborted, true, "the last cancellation aborts the underlying fetch");
  assert.equal((await bible.fetchChapter("NIV", 40, 1))[0].text, "Retry");
  assert.equal(fetchCount, 2, "a cancelled request is removed immediately and remains retryable");
}

{
  const requestedUrls = [];
  const bible = loadBible((url, options) => {
    requestedUrls.push(url);
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      );
    });
  });
  const controller = new AbortController();
  const passage = bible.fetchPassage("matthew", "1:40-2:2", "NIV", {
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(() => passage, /Bible fetch cancelled/);
  assert.equal(requestedUrls.length, 1, "cancellation prevents the next chapter request");
  assert.match(requestedUrls[0], /\/1\/$/);
}

console.log("test-bible.mjs: 16 network, payload, cache, cancellation, red-letter, and passage cases ok");
