/**
 * ChristoDay schedule engine — Asia/Singapore weekdays only.
 * Deterministic segment selection from start date + weekday occurrence count.
 */
(function (global) {
  "use strict";

  const TZ = "Asia/Singapore";
  const START = "2026-06-15"; // Monday, plan epoch
  const MS_PER_DAY = 86400000;

  function partsInSingapore(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
    const map = {};
    for (const p of fmt.formatToParts(date)) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    // en-CA gives YYYY-MM-DD-ish via year/month/day
    const ymd = `${map.year}-${map.month}-${map.day}`;
    const weekdayShort = map.weekday; // Mon, Tue, ...
    const weekdayNum = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }[weekdayShort];
    return { ymd, weekdayShort, weekdayNum, year: +map.year, month: +map.month, day: +map.day };
  }

  /** Parse YYYY-MM-DD as a calendar date in Singapore (no UTC shift). */
  function ymdToUtcNoon(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 4, 0, 0)); // ~noon SGT
  }

  function addDaysYmd(ymd, delta) {
    const dt = ymdToUtcNoon(ymd);
    dt.setUTCDate(dt.getUTCDate() + delta);
    return partsInSingapore(dt).ymd;
  }

  function weekdayOfYmd(ymd) {
    return partsInSingapore(ymdToUtcNoon(ymd)).weekdayNum;
  }

  /** Whole calendar days from aYmd to bYmd (b - a). */
  function daysBetweenYmd(aYmd, bYmd) {
    return Math.round((ymdToUtcNoon(bYmd) - ymdToUtcNoon(aYmd)) / MS_PER_DAY);
  }

  /**
   * Count occurrences of a specific weekday (0=Sun..6=Sat) from startYmd to endYmd inclusive.
   * Both dates are calendar dates in Singapore. O(1) after finding the first match.
   */
  function countWeekdayInclusive(startYmd, endYmd, weekdayNum) {
    if (!startYmd || !endYmd || endYmd < startYmd) return 0;

    // First occurrence of weekdayNum on or after startYmd
    let first = startYmd;
    const startWd = weekdayOfYmd(startYmd);
    if (startWd !== weekdayNum) {
      let delta = (weekdayNum - startWd + 7) % 7;
      if (delta === 0) delta = 7;
      first = addDaysYmd(startYmd, delta);
    }
    if (first > endYmd) return 0;

    return Math.floor(daysBetweenYmd(first, endYmd) / 7) + 1;
  }

  function countMondaysInclusive(startYmd, endYmd) {
    return countWeekdayInclusive(startYmd, endYmd, 1);
  }

  /**
   * @param {object} plan - segments.json
   * @param {string} [ymd] - optional YYYY-MM-DD in Singapore
   */
  function resolveReading(plan, ymd) {
    const today = ymd || partsInSingapore().ymd;
    const wd = weekdayOfYmd(today);
    const start = plan.meta?.startDate || START;

    if (today < start) {
      return {
        kind: "before_start",
        ymd: today,
        message: `Plan begins ${start} (Asia/Singapore). Come back then — or preview a weekday after the start date.`,
      };
    }

    if (wd === 0 || wd === 6) {
      const isSaturday = wd === 6;
      return {
        kind: "weekend",
        ymd: today,
        weekday: isSaturday ? "Saturday" : "Sunday",
        message: isSaturday
          ? "No reading today (Saturday). Rest in the gospel — the plan resumes Monday."
          : "No reading today (Sunday). Rest in the gospel and prepare your heart for Monday.",
      };
    }

    const bookKey = plan.weekdayMap[String(wd)];
    const book = plan.books[bookKey];
    if (!book) {
      return { kind: "error", ymd: today, message: "Unknown weekday mapping." };
    }

    let ref;
    let segmentIndex = 0;
    let segmentLabel;

    if (book.mode === "rotation") {
      // Jude: number of Mondays from start to today inclusive
      // Prompt: %4 == 1 full, == 2 a, == 3 b, == 0 c
      const judeTurn = countMondaysInclusive(start, today);
      const map = { 1: 0, 2: 1, 3: 2, 0: 3 };
      const idx = map[judeTurn % 4];
      const rot = book.rotations[idx];
      ref = rot.ref;
      segmentIndex = idx;
      segmentLabel = rot.label;
    } else {
      const occurrences = countWeekdayInclusive(start, today, wd);
      segmentIndex = (occurrences - 1) % book.segments.length;
      ref = book.segments[segmentIndex];
      segmentLabel = `${book.label} ${ref}`;
    }

    const nextYmd = nextWeekdayYmd(today);
    const nextWd = weekdayOfYmd(nextYmd);
    const nextBookKey = plan.weekdayMap[String(nextWd)];
    const nextBook = plan.books[nextBookKey];

    return {
      kind: "reading",
      ymd: today,
      weekdayNum: wd,
      weekdayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][wd],
      bookKey,
      bookLabel: book.label,
      bookFocus: book.focus,
      ref,
      fullRef: `${book.label} ${ref}`,
      segmentIndex,
      segmentLabel: segmentLabel || `${book.label} ${ref}`,
      questions: plan.reflectionTemplates[bookKey] || [],
      next: {
        ymd: nextYmd,
        weekdayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][nextWd],
        bookLabel: nextBook?.label || "",
      },
      timeEstimate: "≈ 5–10 minutes",
    };
  }

  function nextWeekdayYmd(ymd) {
    let cur = addDaysYmd(ymd, 1);
    for (let i = 0; i < 7; i++) {
      const w = weekdayOfYmd(cur);
      if (w >= 1 && w <= 5) return cur;
      cur = addDaysYmd(cur, 1);
    }
    return cur;
  }

  function formatDisplayDate(ymd) {
    const dt = ymdToUtcNoon(ymd);
    return new Intl.DateTimeFormat("en-SG", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dt);
  }

  global.ChristoSchedule = {
    TZ,
    START,
    partsInSingapore,
    resolveReading,
    formatDisplayDate,
    addDaysYmd,
    weekdayOfYmd,
    countWeekdayInclusive,
    countMondaysInclusive,
    daysBetweenYmd,
  };
})(typeof window !== "undefined" ? window : globalThis);
