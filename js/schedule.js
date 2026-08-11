/**
 * ChristoDay schedule engine — Asia/Singapore weekdays only.
 * Deterministic segment selection from start date + weekday occurrence count.
 */
(function (global) {
  "use strict";

  const TZ = "Asia/Singapore";
  const START = "2026-06-15"; // Monday, plan epoch
  const MS_PER_DAY = 86400000;

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function nonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function validYmd(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validPassageRef(value) {
    if (typeof value !== "string") return false;
    const match = /^([1-9]\d*):([1-9]\d*)-(?:([1-9]\d*):)?([1-9]\d*)$/.exec(value.trim());
    if (!match) return false;
    const startChapter = Number(match[1]);
    const startVerse = Number(match[2]);
    const endChapter = match[3] ? Number(match[3]) : startChapter;
    const endVerse = Number(match[4]);
    return endChapter > startChapter || (endChapter === startChapter && endVerse >= startVerse);
  }

  /** Validate fetched plan data before any schedule or rendering consumer uses it. */
  function validatePlan(plan) {
    const errors = [];
    if (!isRecord(plan)) {
      return { ok: false, errors: ["Plan must be an object."] };
    }

    if (!isRecord(plan.meta)) {
      errors.push("Plan metadata is missing.");
    } else {
      if (!validYmd(plan.meta.startDate)) {
        errors.push("Plan startDate must be a real YYYY-MM-DD date.");
      } else if (weekdayOfYmd(plan.meta.startDate) !== 1) {
        errors.push("Plan startDate must be a Monday.");
      }
      if (plan.meta.timezone !== TZ) {
        errors.push(`Plan timezone must be ${TZ}.`);
      }
    }

    if (!isRecord(plan.weekdayMap)) errors.push("Plan weekdayMap is missing.");
    if (!isRecord(plan.books)) errors.push("Plan books catalog is missing.");
    if (!isRecord(plan.reflectionTemplates)) errors.push("Plan reflection templates are missing.");

    if (!isRecord(plan.weekdayMap) || !isRecord(plan.books)) {
      return { ok: false, errors };
    }

    for (let weekday = 1; weekday <= 5; weekday += 1) {
      const bookKey = plan.weekdayMap[String(weekday)];
      if (!nonEmptyString(bookKey)) {
        errors.push(`Weekday ${weekday} has no book mapping.`);
        continue;
      }

      const book = plan.books[bookKey];
      if (!isRecord(book)) {
        errors.push(`Mapped book ${bookKey} is missing.`);
        continue;
      }
      if (!nonEmptyString(book.label)) errors.push(`${bookKey} has no label.`);
      if (!nonEmptyString(book.focus)) errors.push(`${bookKey} has no focus.`);

      if (book.mode === "rotation") {
        if (!Array.isArray(book.rotations) || book.rotations.length !== 4) {
          errors.push(`${bookKey} must have exactly four rotations.`);
        } else {
          book.rotations.forEach((rotation, index) => {
            if (!isRecord(rotation) || !nonEmptyString(rotation.label)) {
              errors.push(`${bookKey} rotation ${index + 1} has no label.`);
            }
            if (!isRecord(rotation) || !validPassageRef(rotation.ref)) {
              errors.push(`${bookKey} rotation ${index + 1} has an invalid reference.`);
            }
          });
        }
      } else {
        if (book.mode != null) errors.push(`${bookKey} has an unsupported mode.`);
        if (!Array.isArray(book.segments) || !book.segments.length) {
          errors.push(`${bookKey} must have at least one segment.`);
        } else if (book.segments.some((reference) => !validPassageRef(reference))) {
          errors.push(`${bookKey} has an invalid segment reference.`);
        }
      }

      const questions = plan.reflectionTemplates?.[bookKey];
      if (
        !Array.isArray(questions)
        || !questions.length
        || questions.some((question) => !nonEmptyString(question))
      ) {
        errors.push(`${bookKey} must have at least one valid reflection prompt.`);
      }
    }

    return { ok: errors.length === 0, errors };
  }

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
    validatePlan,
    resolveReading,
    formatDisplayDate,
    addDaysYmd,
    weekdayOfYmd,
    countWeekdayInclusive,
    countMondaysInclusive,
    daysBetweenYmd,
  };
})(typeof window !== "undefined" ? window : globalThis);
