/**
 * Explicit, bounded device copies of passages whose terms allow local storage.
 * Other translations are refused and never written.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "christoday.readings.v1";
  const MAX_SAVED_READINGS = 30;
  const MAX_LIBRARY_BYTES = 500_000;
  const MAX_VERSES = 200;

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function plainText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  function emptyLibrary() {
    return { items: {} };
  }

  function passageAllowed(translation) {
    return global.ChristoBible?.allowsLocalPassageStorage?.(translation) === true;
  }

  function keyFor(ymd, translation) {
    return `${ymd}:${translation}`;
  }

  function validPassage(value, translation) {
    const source = isRecord(value?.passage) ? value.passage : value;
    if (!isRecord(source) || !Array.isArray(source.verses)) return null;
    const verses = [];
    for (const verse of source.verses) {
      if (!isRecord(verse)) return null;
      const chapter = Number(verse.chapter);
      const number = Number(verse.verse);
      const text = plainText(verse.text);
      if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(number) || number < 1) return null;
      if (!text || text.length > 4000) return null;
      const row = { chapter, verse: number, text };
      const heading = plainText(verse.heading);
      if (heading) row.heading = heading.slice(0, 80);
      verses.push(row);
      if (verses.length > MAX_VERSES) return null;
    }
    if (!verses.length) return null;
    return { translation, verses };
  }

  function validYmd(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function hydrate(saved) {
    const library = emptyLibrary();
    const items = isRecord(saved?.items) ? saved.items : null;
    if (!items) return library;
    for (const value of Object.values(items)) {
      if (!isRecord(value) || !validYmd(value.ymd) || !passageAllowed(value.translation)) continue;
      const passage = validPassage(value, value.translation);
      if (!passage) continue;
      library.items[keyFor(value.ymd, value.translation)] = {
        ymd: value.ymd,
        translation: value.translation,
        ref: typeof value.ref === "string" ? plainText(value.ref).slice(0, 80) : "",
        bookKey: typeof value.bookKey === "string" ? value.bookKey : "",
        bookLabel: typeof value.bookLabel === "string" ? plainText(value.bookLabel).slice(0, 40) : "",
        savedAt: typeof value.savedAt === "string" ? value.savedAt : "",
        passage,
      };
    }
    return library;
  }

  function load(storage = global.localStorage) {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      return hydrate(raw ? JSON.parse(raw) : null);
    } catch {
      return emptyLibrary();
    }
  }

  function save(library, storage = global.localStorage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(hydrate(library)));
      return true;
    } catch {
      return false;
    }
  }

  function get(library, ymd, translation) {
    if (!passageAllowed(translation)) return null;
    return library?.items?.[keyFor(ymd, translation)] || null;
  }

  function put(library, entry) {
    const current = hydrate(library);
    if (!passageAllowed(entry?.translation)) {
      return { ok: false, reason: "not-permitted", library: current };
    }
    const passage = validPassage(entry, entry.translation);
    if (!validYmd(entry?.ymd) || !passage) {
      return { ok: false, reason: "invalid", library: current };
    }
    const id = keyFor(entry.ymd, entry.translation);
    if (!current.items[id] && Object.keys(current.items).length >= MAX_SAVED_READINGS) {
      return { ok: false, reason: "full", library: current };
    }
    const next = hydrate({
      items: {
        ...current.items,
        [id]: {
          ymd: entry.ymd,
          translation: entry.translation,
          ref: entry.ref,
          bookKey: entry.bookKey,
          bookLabel: entry.bookLabel,
          savedAt: entry.savedAt,
          passage,
        },
      },
    });
    if (JSON.stringify(next).length > MAX_LIBRARY_BYTES) {
      return { ok: false, reason: "too-large", library: current };
    }
    return { ok: true, library: next };
  }

  function remove(library, ymd, translation) {
    const next = hydrate(library);
    delete next.items[keyFor(ymd, translation)];
    return next;
  }

  function availability({ translation, saved, loaded }) {
    const permitted = passageAllowed(translation);
    if (!permitted) {
      return {
        permitted: false,
        saved: false,
        text: `${translation} text is not stored. Offline, this reading stays reference-only.`,
      };
    }
    if (saved && loaded === "saved") {
      return {
        permitted: true,
        saved: true,
        text: `Showing the ${translation} copy saved on this device.`,
      };
    }
    if (saved) {
      return {
        permitted: true,
        saved: true,
        text: `${translation} is saved on this device for offline.`,
      };
    }
    return {
      permitted: true,
      saved: false,
      text: `${translation} is not saved yet. You can keep this reading on this device.`,
    };
  }

  global.ChristoReadings = {
    STORAGE_KEY,
    MAX_SAVED_READINGS,
    MAX_LIBRARY_BYTES,
    empty: emptyLibrary,
    hydrate,
    load,
    save,
    get,
    put,
    remove,
    availability,
  };
})(typeof window !== "undefined" ? window : globalThis);
