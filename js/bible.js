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
  const GOSPEL_BOOKS = new Set(["matthew", "mark", "luke"]);
  const BOOK_NAMES = {
    1: "Genesis",
    2: "Exodus",
    3: "Leviticus",
    4: "Numbers",
    5: "Deuteronomy",
    6: "Joshua",
    7: "Judges",
    8: "Ruth",
    9: "1 Samuel",
    10: "2 Samuel",
    11: "1 Kings",
    12: "2 Kings",
    13: "1 Chronicles",
    14: "2 Chronicles",
    15: "Ezra",
    16: "Nehemiah",
    17: "Esther",
    18: "Job",
    19: "Psalm",
    20: "Proverbs",
    21: "Ecclesiastes",
    22: "Song of Songs",
    23: "Isaiah",
    24: "Jeremiah",
    25: "Lamentations",
    26: "Ezekiel",
    27: "Daniel",
    28: "Hosea",
    29: "Joel",
    30: "Amos",
    31: "Obadiah",
    32: "Jonah",
    33: "Micah",
    34: "Nahum",
    35: "Habakkuk",
    36: "Zephaniah",
    37: "Haggai",
    38: "Zechariah",
    39: "Malachi",
    40: "Matthew",
    41: "Mark",
    42: "Luke",
    43: "John",
    44: "Acts",
    45: "Romans",
    46: "1 Corinthians",
    47: "2 Corinthians",
    48: "Galatians",
    49: "Ephesians",
    50: "Philippians",
    51: "Colossians",
    52: "1 Thessalonians",
    53: "2 Thessalonians",
    54: "1 Timothy",
    55: "2 Timothy",
    56: "Titus",
    57: "Philemon",
    58: "Hebrews",
    59: "James",
    60: "1 Peter",
    61: "2 Peter",
    62: "1 John",
    63: "2 John",
    64: "3 John",
    65: "Jude",
    66: "Revelation",
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
      .map((verse) => {
        const row = { verse: Number(verse.verse), text: verse.text };
        if (typeof verse.comment === "string" && verse.comment) {
          row.comment = verse.comment;
        }
        return row;
      })
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
      const base = `https://bolls.life`;
      const suffix = `/${encodeURIComponent(translation)}/${bookId}/${chapter}/`;
      const chapterUrl = `${base}/get-chapter${suffix}`;
      const textUrl = `${base}/get-text${suffix}`;
      const res = await fetch(chapterUrl, { mode: "cors", signal: controller.signal });
      if (res.ok) {
        const payload = await res.json();
        if (controller.signal.aborted) {
          throw timedOut ? new Error("Bible fetch timed out") : cancellationError();
        }
        return normalizeChapterData(payload);
      }
      if (res.status !== 404) throw new Error(`Bible fetch failed (${res.status})`);
      const fallback = await fetch(textUrl, { mode: "cors", signal: controller.signal });
      if (!fallback.ok) throw new Error(`Bible fetch failed (${fallback.status})`);
      const payload = await fallback.json();
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

  function sanitizeVerseHtml(raw) {
    return String(raw || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/<br\s*\/?>/gi, "<br>")
      .replace(/<\/?(?:i|em)\b[^>]*>/gi, (tag) => (/^<\//.test(tag) ? "</i>" : "<i>"))
      .replace(/<(?!\/?(?:i|br)\b)[^>]+>/gi, "");
  }

  function splitSectionHeading(html) {
    const match = /<br\s*\/?>/i.exec(html);
    if (!match || match.index <= 0) return { heading: "", body: html };
    const lead = stripHtml(html.slice(0, match.index));
    if (!lead || lead.length > 48) return { heading: "", body: html };
    if (/[.?!;:]$/.test(lead)) return { heading: "", body: html };
    if (/^[\u201C"]/.test(lead)) return { heading: "", body: html };
    return {
      heading: lead,
      body: html.slice(match.index + match[0].length),
    };
  }

  function wrapWordsOfJesus(html, bookKey, chapter, verse) {
    if (!GOSPEL_BOOKS.has(bookKey)) return html;
    return global.ChristoRedLetter?.renderHtml?.(html, bookKey, chapter, verse) || html;
  }

  function rewriteCommentHtml(raw) {
    if (!raw) return "";
    const links = [];
    let html = String(raw).replace(/<br\s*\/?>/gi, "<br>");
    html = html.replace(
      /<a\s+[^>]*href\s*=\s*['"]\/?([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href, label) => {
        const ref = String(href || "").replace(/^\/+/, "");
        if (!parseRemoteRef(ref)) return escapeHtml(stripHtml(label));
        const token = `CHRISTOREF${links.length}TOKEN`;
        links.push(
          `<button type="button" class="xref-link" data-ref="${escapeHtml(ref)}">${escapeHtml(stripHtml(label))}</button>`
        );
        return token;
      }
    );
    html = html.replace(/<(?!\/?(?:i|br)\b)[^>]+>/gi, "");
    html = html.replace(/CHRISTOREF(\d+)TOKEN/g, (_, index) => links[Number(index)] || "");
    return html.trim();
  }

  function parseRemoteRef(ref) {
    const match = /^([A-Za-z0-9]+)\/(\d+)\/(\d+)(?:\/(\d+(?:-\d+)?))?$/.exec(
      String(ref || "").replace(/^\/+/, "")
    );
    if (!match) return null;
    const verseToken = match[4] || "";
    const verseParts = verseToken.split("-").map(Number);
    return {
      translation: match[1],
      bookId: Number(match[2]),
      chapter: Number(match[3]),
      verseFrom: verseParts[0] || 1,
      verseTo: verseParts[1] || verseParts[0] || 1,
      label: formatRemoteRefLabel(Number(match[2]), Number(match[3]), verseToken),
    };
  }

  function formatRemoteRefLabel(bookId, chapter, verseToken) {
    const book = BOOK_NAMES[bookId] || `Book ${bookId}`;
    if (!verseToken) return `${book} ${chapter}`;
    return `${book} ${chapter}:${verseToken}`;
  }

  function verseMarkup(verse) {
    const heading = verse.heading
      ? `<span class="section-head">${escapeHtml(verse.heading)}</span>`
      : "";
    const note = verse.commentHtml
      ? `<sup class="fn"><button type="button" class="fn-mark" data-verse-key="${verse.chapter}:${verse.verse}" aria-label="Cross references for ${verse.chapter}:${verse.verse}">†</button></sup>`
      : "";
    return `${heading}<span class="verse" data-chapter="${verse.chapter}" data-verse="${verse.verse}"><button type="button" class="vnum" title="Copy ${verse.chapter}:${verse.verse}" aria-label="Copy ${verse.chapter}:${verse.verse}">${verse.chapter}:${verse.verse}</button> ${verse.html}${note}</span>`;
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
      for (const v of chapterData) {
        const n = Number(v.verse);
        if (n >= range.verseFrom && n <= range.verseTo) {
          const sanitized = sanitizeVerseHtml(v.text || "");
          const split = splitSectionHeading(sanitized);
          const bodyHtml = wrapWordsOfJesus(split.body, bookKey, range.chapter, n);
          collected.push({
            chapter: range.chapter,
            verse: n,
            text: stripHtml(v.text || ""),
            html: bodyHtml,
            heading: split.heading,
            comment: v.comment || "",
            commentHtml: rewriteCommentHtml(v.comment || ""),
          });
        }
      }
    }

    if (!collected.length) throw new Error("Bible API returned no verses for passage");
    if (signal?.aborted) throw cancellationError();

    const text = collected.map((v) => v.text).join(" ");
    const html = collected.map((v) => verseMarkup(v)).join(" ");

    return { text, html, translation: tr, verses: collected };
  }

  async function fetchVersePreview(ref, options = {}) {
    const parsed = parseRemoteRef(ref);
    if (!parsed) throw new Error("Unknown reference");
    const chapter = await fetchChapter(
      parsed.translation,
      parsed.bookId,
      parsed.chapter,
      FETCH_TIMEOUT_MS,
      options.signal
    );
    const verses = chapter.filter(
      (verse) => verse.verse >= parsed.verseFrom && verse.verse <= parsed.verseTo
    );
    if (!verses.length) throw new Error("No verse text for that reference");
    return {
      label: parsed.label,
      translation: parsed.translation,
      text: verses.map((verse) => stripHtml(verse.text || "")).join(" "),
    };
  }

  global.ChristoBible = {
    BOOK_IDS,
    BOOK_NAMES,
    GOSPEL_BOOKS,
    TRANSLATIONS,
    FETCH_TIMEOUT_MS,
    MAX_CACHED_CHAPTERS,
    parseRef,
    parseRemoteRef,
    normalizeChapterData,
    sanitizeVerseHtml,
    wrapWordsOfJesus,
    rewriteCommentHtml,
    fetchChapter,
    fetchPassage,
    fetchVersePreview,
    clearChapterCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
