/** Persisted ChristoDay state boundary. */
(function (global) {
  "use strict";

  const STORAGE_KEY = "christoday.v1";
  const TRANSLATIONS = new Set(["NIV", "ESV", "NKJV", "WEB"]);

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validTranslation(value, fallback = "NIV") {
    return TRANSLATIONS.has(value) ? value : fallback;
  }

  function defaultState() {
    return { translation: "NIV", days: {} };
  }

  function hydrateState(saved) {
    const hydrated = defaultState();
    if (!isRecord(saved)) return hydrated;
    hydrated.translation = validTranslation(saved.translation);
    if (!isRecord(saved.days)) return hydrated;

    for (const [ymd, value] of Object.entries(saved.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !isRecord(value)) continue;
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
    storage.setItem(STORAGE_KEY, JSON.stringify(hydrateState(state)));
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

  global.ChristoState = { STORAGE_KEY, defaultState, hydrateState, loadState, saveState, ensureDay };
})(typeof window !== "undefined" ? window : globalThis);
