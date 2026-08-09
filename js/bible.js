/**
 * Live Bible text via bolls.life (public), with graceful offline fallback.
 */
(function (global) {
  "use strict";

  const BOOK_IDS = {
    matthew: 40,
    mark: 41,
    luke: 42,
    philippians: 50,
    jude: 65,
  };

  const TRANSLATIONS = {
    NIV: { code: "NIV", label: "NIV" },
    ESV: { code: "ESV", label: "ESV" },
    NKJV: { code: "NKJV", label: "NKJV" },
    WEB: { code: "WEB", label: "WEB" },
  };
  const FETCH_TIMEOUT_MS = 10_000;
  const MAX_CACHED_CHAPTERS = 50;
  const chapterCache = new Map();
  const chapterRequests = new Map();

  /**
   * Parse refs like "1:1-17", "1:40-2:12", "16:1-8"
   * Returns array of { chapter, verseFrom, verseTo }
   */
  function parseRef(ref) {
    const parts = [];
    // Split multi-chapter ranges: 1:40-2:12 or single chapter 5:1-12 or 3:13-17
    const cross = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(ref);
    if (cross) {
      const c1 = +cross[1];
      const v1 = +cross[2];
      const c2 = +cross[3];
      const v2 = +cross[4];
      if (c1 === c2) {
        parts.push({ chapter: c1, verseFrom: v1, verseTo: v2 });
      } else {
        parts.push({ chapter: c1, verseFrom: v1, verseTo: 999 });
        for (let c = c1 + 1; c < c2; c++) {
          parts.push({ chapter: c, verseFrom: 1, verseTo: 999 });
        }
        parts.push({ chapter: c2, verseFrom: 1, verseTo: v2 });
      }
      return parts;
    }
    const single = /^(\d+):(\d+)-(\d+)$/.exec(ref);
    if (single) {
      parts.push({ chapter: +single[1], verseFrom: +single[2], verseTo: +single[3] });
      return parts;
    }
    const one = /^(\d+):(\d+)$/.exec(ref);
    if (one) {
      parts.push({ chapter: +one[1], verseFrom: +one[2], verseTo: +one[2] });
      return parts;
    }
    return parts;
  }

  function normalizeChapterData(payload) {
    const rawVerses = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.verses)
        ? payload.verses
        : null;
    if (!rawVerses) throw new Error("Bible API returned invalid chapter data");
    return rawVerses
      .filter((verse) => verse && typeof verse === "object")
      .map((verse) => ({ verse: Number(verse.verse), text: verse.text }))
      .filter(
        (verse) =>
          Number.isInteger(verse.verse) && verse.verse > 0 && typeof verse.text === "string"
      );
  }

  function cancellationError() {
    const error = new Error("Bible fetch cancelled");
    error.name = "AbortError";
    return error;
  }

  async function requestChapter(translation, bookId, chapter, timeoutMs, requestSignal) {
    const url = `https://bolls.life/get-text/${encodeURIComponent(translation)}/${bookId}/${chapter}/`;
    const controller = new AbortController();
    let timedOut = false;
    const cancelRequest = () => controller.abort();
    if (requestSignal?.aborted) cancelRequest();
    else requestSignal?.addEventListener("abort", cancelRequest, { once: true });
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const res = await fetch(url, { mode: "cors", signal: controller.signal });
      if (!res.ok) throw new Error(`Bible fetch failed (${res.status})`);
      const payload = await res.json();
      if (controller.signal.aborted) {
        throw timedOut ? new Error("Bible fetch timed out") : cancellationError();
      }
      return normalizeChapterData(payload);
    } catch (error) {
      if (timedOut) throw new Error("Bible fetch timed out");
      if (requestSignal?.aborted) throw cancellationError();
      throw error;
    } finally {
      clearTimeout(timeoutId);
      requestSignal?.removeEventListener("abort", cancelRequest);
    }
  }

  /** Give each caller independent cancellation without breaking shared fetches. */
  function subscribeToChapter(entry, key, signal) {
    entry.consumers += 1;
    return new Promise((resolve, reject) => {
      let released = false;
      const release = (cancelled) => {
        if (released) return;
        released = true;
        signal?.removeEventListener("abort", onAbort);
        entry.consumers = Math.max(0, entry.consumers - 1);
        if (cancelled && entry.pending && entry.consumers === 0) {
          if (chapterRequests.get(key) === entry) chapterRequests.delete(key);
          entry.controller.abort();
        }
      };
      const onAbort = () => {
        release(true);
        reject(cancellationError());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      entry.promise.then(
        (data) => {
          if (released) return;
          release(false);
          resolve(data);
        },
        (error) => {
          if (released) return;
          release(false);
          reject(error);
        }
      );
    });
  }

  /**
   * Fetch/cache one chapter. The optional fifth argument cancels only this
   * consumer; the network request is aborted when no consumers remain.
   */
  function fetchChapter(
    translation,
    bookId,
    chapter,
    timeoutMs = FETCH_TIMEOUT_MS,
    signal
  ) {
    if (signal?.aborted) return Promise.reject(cancellationError());
    const key = `${translation}:${bookId}:${chapter}`;
    if (chapterCache.has(key)) return Promise.resolve(chapterCache.get(key));

    let entry = chapterRequests.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { consumers: 0, controller, pending: true, promise: null };
      entry.promise = requestChapter(translation, bookId, chapter, timeoutMs, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) throw cancellationError();
          if (chapterCache.size >= MAX_CACHED_CHAPTERS) {
            chapterCache.delete(chapterCache.keys().next().value);
          }
          chapterCache.set(key, data);
          return data;
        })
        .finally(() => {
          entry.pending = false;
          if (chapterRequests.get(key) === entry) chapterRequests.delete(key);
        });
      chapterRequests.set(key, entry);
    }
    return subscribeToChapter(entry, key, signal);
  }

  function clearChapterCache() {
    chapterCache.clear();
    for (const entry of chapterRequests.values()) entry.controller.abort();
    chapterRequests.clear();
  }

  /**
   * @param {{ signal?: AbortSignal }} options
   * @returns {Promise<{ text: string, html: string, translation: string, verses: Array }>}
   */
  async function fetchPassage(bookKey, ref, translation = "NIV", options = {}) {
    const signal = options?.signal;
    if (signal?.aborted) throw cancellationError();
    const bookId = BOOK_IDS[bookKey];
    if (!bookId) throw new Error("Unknown book");
    const ranges = parseRef(ref);
    if (!ranges.length) throw new Error("Could not parse reference: " + ref);

    const tr = TRANSLATIONS[translation] ? translation : "NIV";
    const collected = [];

    for (const range of ranges) {
      const chapterData = await fetchChapter(
        tr,
        bookId,
        range.chapter,
        FETCH_TIMEOUT_MS,
        signal
      );
      if (signal?.aborted) throw cancellationError();
      // bolls returns array of { pk, verse, text }
      for (const v of chapterData) {
        const n = Number(v.verse);
        if (n >= range.verseFrom && n <= range.verseTo) {
          collected.push({ chapter: range.chapter, verse: n, text: stripHtml(v.text || "") });
        }
      }
    }

    if (!collected.length) throw new Error("Bible API returned no verses for passage");
    if (signal?.aborted) throw cancellationError();

    const text = collected.map((v) => v.text).join(" ");
    const html = collected
      .map((v) => `<sup class="vnum">${v.chapter}:${v.verse}</sup> ${escapeHtml(v.text)}`)
      .join(" ");

    return { text, html, translation: tr, verses: collected };
  }

  function stripHtml(s) {
    return String(s)
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.ChristoBible = {
    BOOK_IDS,
    TRANSLATIONS,
    FETCH_TIMEOUT_MS,
    MAX_CACHED_CHAPTERS,
    parseRef,
    normalizeChapterData,
    fetchChapter,
    fetchPassage,
    clearChapterCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
