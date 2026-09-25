/** Persisted ChristoDay state boundary. */
(function (global) {
  "use strict";

  const STORAGE_KEY = "christoday.v1";
  const BACKUP_PRODUCT = "ChristoDay";
  const BACKUP_SCHEMA_VERSION = 1;
  const MAX_BACKUP_BYTES = 1_000_000;
  const TRANSLATIONS = new Set(["NIV", "ESV", "NKJV", "WEB"]);

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validTranslation(value, fallback = "NIV") {
    return TRANSLATIONS.has(value) ? value : fallback;
  }

  function validYmd(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function validPassageSize(value) {
    return value === "sm" || value === "lg" ? value : "md";
  }

  function validLineSpacing(value) {
    return value === "tight" || value === "open" ? value : "normal";
  }

  function defaultState() {
    return {
      translation: "NIV",
      days: {},
      passageSize: "md",
      lineSpacing: "normal",
      readingFocus: false,
      includeShareNote: false,
    };
  }

  function hydrateState(saved) {
    const hydrated = defaultState();
    if (!isRecord(saved)) return hydrated;
    hydrated.translation = validTranslation(saved.translation);
    hydrated.passageSize = validPassageSize(saved.passageSize);
    hydrated.lineSpacing = validLineSpacing(saved.lineSpacing);
    hydrated.readingFocus = saved.readingFocus === true;
    hydrated.includeShareNote = saved.includeShareNote === true;
    if (!isRecord(saved.days)) return hydrated;

    for (const [ymd, value] of Object.entries(saved.days)) {
      if (!validYmd(ymd) || !isRecord(value)) continue;
      const day = {
        completed: value.completed === true,
        journal: typeof value.journal === "string" ? value.journal : "",
        translation: validTranslation(value.translation, hydrated.translation),
      };
      if (typeof value.completedAt === "string") day.completedAt = value.completedAt;
      hydrated.days[ymd] = day;
    }
    return hydrated;
  }

  function loadState(storage = global.localStorage) {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      return raw ? hydrateState(JSON.parse(raw)) : defaultState();
    } catch {
      return defaultState();
    }
  }

  function saveState(state, storage = global.localStorage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(hydrateState(state)));
      return true;
    } catch {
      return false;
    }
  }

  function lastDayYmd(state) {
    let latest = "";
    if (!isRecord(state?.days)) return latest;
    for (const ymd of Object.keys(state.days)) {
      if (validYmd(ymd) && ymd > latest) latest = ymd;
    }
    return latest;
  }

  function backupFocusYmd(state) {
    return validYmd(state?.currentYmd) ? state.currentYmd : lastDayYmd(state);
  }

  function restoreOpenYmd(state, todayYmd, isReadingYmd) {
    const today = validYmd(todayYmd) ? todayYmd : "";
    const focus = backupFocusYmd(state);
    if (focus && typeof isReadingYmd === "function" && isReadingYmd(focus)) return focus;
    return today;
  }

  function createBackup(state, exportedAt = new Date().toISOString(), currentYmd) {
    const backup = {
      product: BACKUP_PRODUCT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt,
      state: hydrateState(state),
    };
    if (validYmd(currentYmd)) backup.currentYmd = currentYmd;
    return backup;
  }

  function parseBackup(raw) {
    if (typeof raw !== "string") throw new Error("Choose a valid JSON backup.");
    if (raw.length > MAX_BACKUP_BYTES) throw new Error("That backup is too large.");

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Choose a valid JSON backup.");
    }
    if (!isRecord(parsed) || parsed.product !== BACKUP_PRODUCT) {
      throw new Error("Choose a ChristoDay backup.");
    }
    if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error("This file uses a newer backup format.");
    }
    if (!isRecord(parsed.state) || !isRecord(parsed.state.days)) {
      throw new Error("This backup is missing reading data.");
    }
    const state = hydrateState(parsed.state);
    if (validYmd(parsed.currentYmd)) state.currentYmd = parsed.currentYmd;
    return state;
  }

  function ensureDay(state, ymd) {
    if (!isRecord(state.days)) state.days = {};
    if (!isRecord(state.days[ymd])) {
      state.days[ymd] = {
        completed: false,
        journal: "",
        translation: validTranslation(state.translation),
      };
    }
    return state.days[ymd];
  }

  global.ChristoState = {
    STORAGE_KEY,
    BACKUP_PRODUCT,
    BACKUP_SCHEMA_VERSION,
    MAX_BACKUP_BYTES,
    defaultState,
    hydrateState,
    loadState,
    saveState,
    createBackup,
    parseBackup,
    backupFocusYmd,
    restoreOpenYmd,
    ensureDay,
    validYmd,
    validPassageSize,
    validLineSpacing,
  };
})(typeof window !== "undefined" ? window : globalThis);
