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

  async function fetchChapter(translation, bookId, chapter, timeoutMs = FETCH_TIMEOUT_MS) {
    const url = `https://bolls.life/get-text/${encodeURIComponent(translation)}/${bookId}/${chapter}/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { mode: "cors", signal: controller.signal });
      if (!res.ok) throw new Error(`Bible fetch failed (${res.status})`);
      return await res.json();
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Bible fetch timed out");
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * @returns {Promise<{ text: string, html: string, translation: string, verses: Array }>}
   */
  async function fetchPassage(bookKey, ref, translation = "NIV") {
    const bookId = BOOK_IDS[bookKey];
    if (!bookId) throw new Error("Unknown book");
    const ranges = parseRef(ref);
    if (!ranges.length) throw new Error("Could not parse reference: " + ref);

    const tr = TRANSLATIONS[translation] ? translation : "NIV";
    const collected = [];

    for (const range of ranges) {
      const chapterData = await fetchChapter(tr, bookId, range.chapter);
      // bolls returns array of { pk, verse, text }
      const verses = Array.isArray(chapterData) ? chapterData : chapterData.verses || [];
      for (const v of verses) {
        const n = Number(v.verse);
        if (n >= range.verseFrom && n <= range.verseTo) {
          collected.push({ chapter: range.chapter, verse: n, text: stripHtml(v.text || "") });
        }
      }
    }

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
    parseRef,
    fetchChapter,
    fetchPassage,
  };
})(typeof window !== "undefined" ? window : globalThis);
