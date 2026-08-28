/**
 * ChristoDay — daily Christ-centered gospel reading app.
 */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);

  const TRANSLATIONS = new Set(["NIV", "ESV", "NKJV", "WEB"]);

  let plan = null;
  let state = ChristoState.loadState();
  let currentYmd = null;
  /** Monotonic token so slow Bible fetches don't clobber a newer day. */
  let renderSeq = 0;
  let passageController = null;
  let actionStatusTimer = 0;
  let speaking = false;
  let lastPassage = null;
  let previewController = null;

  function bindAutoHideHeader() {
    const header = $(".topbar");
    if (!header) return;
    let lastY = Math.max(0, window.scrollY);
    let ticking = false;

    function update() {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      if (y <= 16 || delta < 0 || header.matches(":focus-within")) {
        header.classList.remove("is-scroll-hidden");
      } else if (delta > 0 && y > header.offsetHeight) {
        header.classList.add("is-scroll-hidden");
      }
      lastY = y;
      ticking = false;
    }

    header.addEventListener("focusin", () => header.classList.remove("is-scroll-hidden"));
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

  function saveState() {
    const saved = ChristoState.saveState(state);
    const status = $("#storage-status");
    if (status) {
      status.hidden = saved;
      status.textContent = saved
        ? ""
        : "Could not save on this device. Your current entry remains visible, but may be lost when this tab closes.";
    }
    return saved;
  }

  function ensureDay(ymd) {
    return ChristoState.ensureDay(state, ymd);
  }

  function computeStreak(todayYmd) {
    // Count consecutive weekdays completed ending at today (or last weekday)
    let streak = 0;
    let ymd = todayYmd;
    const wd = ChristoSchedule.weekdayOfYmd(ymd);
    if (wd === 0 || wd === 6) {
      // walk back to Friday
      while (ChristoSchedule.weekdayOfYmd(ymd) === 0 || ChristoSchedule.weekdayOfYmd(ymd) === 6) {
        ymd = ChristoSchedule.addDaysYmd(ymd, -1);
      }
    }
    for (let i = 0; i < 400; i++) {
      const w = ChristoSchedule.weekdayOfYmd(ymd);
      if (w >= 1 && w <= 5) {
        if (state.days?.[ymd]?.completed) streak++;
        else break;
      }
      ymd = ChristoSchedule.addDaysYmd(ymd, -1);
      if (ymd < (plan?.meta?.startDate || "2026-06-15")) break;
    }
    return streak;
  }

  function countCompleted() {
    if (!plan) return 0;
    return Object.entries(state.days || {}).filter(
      ([ymd, day]) =>
        day?.completed &&
        ChristoState.validYmd(ymd) &&
        ChristoSchedule.resolveReading(plan, ymd).kind === "reading"
    ).length;
  }

  function previousWeekdayYmd(fromYmd) {
    let ymd = ChristoSchedule.addDaysYmd(fromYmd, -1);
    for (let i = 0; i < 8; i++) {
      const w = ChristoSchedule.weekdayOfYmd(ymd);
      if (w >= 1 && w <= 5) return ymd;
      ymd = ChristoSchedule.addDaysYmd(ymd, -1);
    }
    return ymd;
  }

  function lastIncompleteYmd(fromYmd) {
    const start = plan?.meta?.startDate || "2026-06-15";
    let latest = "";
    for (const [ymd, day] of Object.entries(state.days || {})) {
      const w = ChristoSchedule.weekdayOfYmd(ymd);
      if (
        ymd >= start &&
        ymd < fromYmd &&
        ymd > latest &&
        w >= 1 &&
        w <= 5 &&
        day &&
        !day.completed &&
        String(day.journal || "").trim()
      ) latest = ymd;
    }
    return latest;
  }

  function renderYesterdayLine(ymd) {
    const el = $("#yesterday-line");
    if (!el) return;
    const prev = previousWeekdayYmd(ymd);
    const note = String(state.days?.[prev]?.journal || "").trim();
    if (!note) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = `Yesterday’s line (${ChristoSchedule.formatDisplayDate(prev)}): ${note.slice(0, 180)}`;
  }

  function renderContinueIncomplete(ymd) {
    const btn = $("#btn-continue-incomplete");
    if (!btn) return;
    const target = lastIncompleteYmd(ymd);
    if (!target || target === ymd) {
      btn.hidden = true;
      btn.dataset.ymd = "";
      return;
    }
    btn.hidden = false;
    btn.dataset.ymd = target;
    btn.textContent = `Continue ${ChristoSchedule.formatDisplayDate(target)}`;
  }

  async function init() {
    bindAutoHideHeader();
    bindRefPopover();
    try {
      const res = await fetch("data/segments.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const candidatePlan = await res.json();
      const validation = ChristoSchedule.validatePlan(candidatePlan);
      if (!validation.ok) {
        throw new Error(`Invalid reading plan: ${validation.errors.join(" ")}`);
      }
      plan = candidatePlan;
    } catch (e) {
      console.error("[ChristoDay] plan load failed", e);
      showFatal("Could not load reading plan data.");
      return;
    }

    const params = new URLSearchParams(location.search);
    const requestedYmd = params.get("d");
    const requestedTr = params.get("tr");
    const hadDeepLink = params.has("d") || params.has("tr");
    if (TRANSLATIONS.has(requestedTr)) state.translation = requestedTr;
    currentYmd = ChristoState.validYmd(requestedYmd)
      ? requestedYmd
      : ChristoSchedule.partsInSingapore().ymd;
    bindUi();
    applyPassageSize(state.passageSize);
    applyShareNotePreference(state.includeShareNote);
    await renderDay(currentYmd, { syncUrl: hadDeepLink });
    $("#site-version").textContent = SITE_VERSION?.id || "";
  }

  function bindUi() {
    $("#btn-prev")?.addEventListener("click", () => shiftDay(-1));
    $("#btn-next")?.addEventListener("click", () => shiftDay(1));
    $("#btn-today")?.addEventListener("click", () => renderDay(ChristoSchedule.partsInSingapore().ymd));
    $("#btn-continue-incomplete")?.addEventListener("click", () => {
      const ymd = $("#btn-continue-incomplete")?.dataset.ymd;
      if (ymd) renderDay(ymd);
    });
    $("#btn-complete")?.addEventListener("click", toggleComplete);
    $("#btn-copy")?.addEventListener("click", () => {
      copyVisiblePassage().catch(() => {});
    });
    $("#btn-listen")?.addEventListener("click", () => {
      toggleListen();
    });
    $("#btn-share")?.addEventListener("click", () => {
      shareReading().catch(() => {});
    });
    $("#include-share-note")?.addEventListener("change", (e) => {
      applyShareNotePreference(e.target.checked);
      saveState();
    });
    $("#btn-type-smaller")?.addEventListener("click", () => shiftPassageSize(-1));
    $("#btn-type-larger")?.addEventListener("click", () => shiftPassageSize(1));
    $("#journal")?.addEventListener("input", (e) => {
      const day = ensureDay(currentYmd);
      day.journal = e.target.value;
      saveState();
      updateMeta();
    });
    $("#translation")?.addEventListener("change", async (e) => {
      state.translation = e.target.value;
      const day = ensureDay(currentYmd);
      day.translation = state.translation;
      saveState();
      writeDeepLink(currentYmd, state.translation);
      await loadPassage(renderSeq);
    });
    $("#date-pick")?.addEventListener("change", async (e) => {
      if (e.target.value) await renderDay(e.target.value);
    });
    document.querySelectorAll(".js-preview-monday").forEach((btn) => {
      btn.addEventListener("click", () => renderDay(previewMondayYmd(currentYmd)));
    });
    document.querySelectorAll(".js-last-friday").forEach((btn) => {
      btn.addEventListener("click", () => renderDay(lastFridayYmd(currentYmd)));
    });
    $("#week-strip")?.addEventListener("click", (e) => {
      const dayBtn = e.target.closest("[data-ymd]");
      if (dayBtn?.dataset.ymd) renderDay(dayBtn.dataset.ymd);
    });
    window.addEventListener("hashchange", syncAboutFromHash);
    syncAboutFromHash();
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("textarea, input, select")) return;
      if (e.key === "ArrowLeft") shiftDay(-1);
      if (e.key === "ArrowRight") shiftDay(1);
      if (e.key === "t" || e.key === "T") renderDay(ChristoSchedule.partsInSingapore().ymd);
      if (e.key === "c" || e.key === "C") toggleComplete();
      if ((e.key === "y" || e.key === "Y") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        copyVisiblePassage().catch(() => {});
      }
      if ((e.key === "l" || e.key === "L") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleListen();
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        shiftPassageSize(-1);
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        shiftPassageSize(1);
      }
    });
  }

  const PASSAGE_SIZES = ["sm", "md", "lg"];

  function applyPassageSize(size) {
    const next = ChristoState.validPassageSize
      ? ChristoState.validPassageSize(size)
      : size === "sm" || size === "lg"
        ? size
        : "md";
    state.passageSize = next;
    document.documentElement.setAttribute("data-passage-size", next);
    const smaller = $("#btn-type-smaller");
    const larger = $("#btn-type-larger");
    if (smaller) smaller.disabled = next === "sm";
    if (larger) larger.disabled = next === "lg";
    return next;
  }

  function shiftPassageSize(delta) {
    const current = applyPassageSize(state.passageSize);
    const index = PASSAGE_SIZES.indexOf(current);
    const next = PASSAGE_SIZES[Math.max(0, Math.min(PASSAGE_SIZES.length - 1, index + delta))];
    if (next === current) return;
    applyPassageSize(next);
    saveState();
    announceAction(
      next === "sm" ? "Smaller passage text." : next === "lg" ? "Larger passage text." : "Default passage text."
    );
  }

  function currentTranslation() {
    return TRANSLATIONS.has(state.translation) ? state.translation : "NIV";
  }

  function writeDeepLink(ymd, translation) {
    const url = new URL(location.href);
    url.searchParams.set("d", ymd);
    url.searchParams.set("tr", TRANSLATIONS.has(translation) ? translation : "NIV");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (next !== current) history.replaceState(null, "", next);
  }

  function announceAction(message) {
    const status = $("#action-status");
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    clearTimeout(actionStatusTimer);
    actionStatusTimer = setTimeout(() => {
      if (status.textContent === message) {
        status.hidden = true;
        status.textContent = "";
      }
    }, 2500);
  }

  function visiblePassageText() {
    const ref = ($("#passage-ref")?.textContent || "").trim();
    const body = lastPassage?.verses?.length
      ? lastPassage.verses.map((verse) => `${verse.chapter}:${verse.verse} ${verse.text}`).join(" ")
      : ($("#passage-body")?.innerText || "").replace(/\s+\n/g, "\n").trim();
    if (ref && body) return `${ref}\n\n${body}`;
    return ref || body;
  }

  async function writeClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  async function copyVisiblePassage() {
    const readingEl = $("#reading-panel");
    if (!readingEl || readingEl.hidden) return;
    const text = visiblePassageText();
    if (!text) {
      announceAction("Nothing to copy yet.");
      return;
    }
    const ok = await writeClipboard(text);
    announceAction(ok ? "Copied passage." : "Could not copy passage.");
  }

  function applyShareNotePreference(on) {
    state.includeShareNote = on === true;
    const box = $("#include-share-note");
    if (box) box.checked = state.includeShareNote;
    return state.includeShareNote;
  }

  function currentJournalNote() {
    const fromState = String(state.days?.[currentYmd]?.journal || "").trim();
    if (fromState) return fromState;
    return String($("#journal")?.value || "").trim();
  }

  function shareLine(url) {
    const display = currentYmd ? ChristoSchedule.formatDisplayDate(currentYmd) : "";
    const reading = plan && currentYmd ? ChristoSchedule.resolveReading(plan, currentYmd) : null;
    const ref = reading?.kind === "reading"
      ? reading.fullRef
      : ($("#passage-ref")?.textContent || "").trim();
    const line = [display, ref, url].filter(Boolean).join(" · ");
    const note = state.includeShareNote ? currentJournalNote() : "";
    return note ? `${line}\n\n${note}` : line;
  }

  async function shareReading() {
    writeDeepLink(currentYmd, currentTranslation());
    const url = location.href;
    const line = shareLine(url);
    const reading = plan && currentYmd ? ChristoSchedule.resolveReading(plan, currentYmd) : null;
    const title = reading?.kind === "reading" ? reading.fullRef : "ChristoDay";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: line, url });
        announceAction("Shared today's reading.");
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
    const ok = await writeClipboard(line);
    announceAction(ok ? "Copied today's reading." : "Could not share today's reading.");
  }

  function findWeekdayYmd(fromYmd, weekdayNum, direction) {
    let ymd = ChristoSchedule.addDaysYmd(fromYmd, direction);
    for (let i = 0; i < 8; i++) {
      if (ChristoSchedule.weekdayOfYmd(ymd) === weekdayNum) return ymd;
      ymd = ChristoSchedule.addDaysYmd(ymd, direction);
    }
    return ymd;
  }

  function previewMondayYmd(ymd) {
    const start = plan?.meta?.startDate || ChristoSchedule.START;
    const nextMonday = findWeekdayYmd(ymd, 1, 1);
    return nextMonday < start ? start : nextMonday;
  }

  function lastFridayYmd(ymd) {
    return findWeekdayYmd(ymd, 5, -1);
  }

  function weekMondayYmd(ymd) {
    const weekday = ChristoSchedule.weekdayOfYmd(ymd);
    if (weekday === 0) return ChristoSchedule.addDaysYmd(ymd, -6);
    if (weekday === 6) return ChristoSchedule.addDaysYmd(ymd, -5);
    return ChristoSchedule.addDaysYmd(ymd, 1 - weekday);
  }

  function renderWeekStrip(ymd) {
    const strip = $("#week-strip");
    if (!strip) return;
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const monday = weekMondayYmd(ymd);
    strip.innerHTML = labels.map((label, index) => {
      const dayYmd = ChristoSchedule.addDaysYmd(monday, index);
      const done = !!state.days?.[dayYmd]?.completed;
      const display = ChristoSchedule.formatDisplayDate(dayYmd);
      const classes = done ? "badge week-day btn-primary is-done" : "badge week-day";
      return `<button type="button" class="${classes}" data-ymd="${dayYmd}" aria-pressed="${done ? "true" : "false"}" aria-label="${escapeHtml(display)}${done ? ", completed" : ", not completed"}">${label}</button>`;
    }).join("");
  }

  function syncAboutFromHash() {
    const about = $("#about");
    if (about instanceof HTMLDetailsElement && location.hash === "#about") {
      about.open = true;
    }
  }

  function shiftDay(delta) {
    renderDay(ChristoSchedule.addDaysYmd(currentYmd, delta));
  }

  function toggleComplete() {
    const reading = ChristoSchedule.resolveReading(plan, currentYmd);
    if (reading.kind !== "reading") return;
    const day = ensureDay(currentYmd);
    day.completed = !day.completed;
    if (day.completed) day.completedAt = new Date().toISOString();
    saveState();
    updateCompleteButton(day.completed);
    updateMeta();
  }

  function updateCompleteButton(done) {
    const btn = $("#btn-complete");
    if (!btn) return;
    btn.classList.toggle("is-done", done);
    btn.setAttribute("aria-pressed", done ? "true" : "false");
    btn.innerHTML = done
      ? `<span aria-hidden="true">✓</span> Completed`
      : `<span aria-hidden="true">○</span> Mark complete`;
  }

  function updateMeta() {
    const today = ChristoSchedule.partsInSingapore().ymd;
    $("#stat-streak").textContent = String(computeStreak(today));
    $("#stat-done").textContent = String(countCompleted());
  }

  function renderListeningState(active) {
    speaking = active;
    const btn = $("#btn-listen");
    if (btn) {
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.textContent = active ? "Stop" : "Listen";
    }
  }

  function stopListening() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    renderListeningState(false);
  }

  function toggleListen() {
    const readingEl = $("#reading-panel");
    if (!readingEl || readingEl.hidden) return;
    if (speaking) {
      stopListening();
      announceAction("Stopped reading.");
      return;
    }
    const text = visiblePassageText();
    if (!text) {
      announceAction("Nothing to read yet.");
      return;
    }
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
      announceAction("Speech is not available on this device.");
      return;
    }
    stopListening();
    const utterance = new window.SpeechSynthesisUtterance();
    utterance.text = text;
    utterance.rate = 0.92;
    utterance.onend = () => {
      renderListeningState(false);
    };
    utterance.onerror = () => {
      renderListeningState(false);
      announceAction("Could not read passage.");
    };
    renderListeningState(true);
    window.speechSynthesis.speak(utterance);
    announceAction("Reading aloud…");
  }

  async function renderDay(ymd, options = {}) {
    const seq = ++renderSeq;
    currentYmd = ymd;
    stopListening();
    const reading = ChristoSchedule.resolveReading(plan, ymd);
    const datePick = $("#date-pick");
    if (datePick) datePick.value = ymd;
    if (options.syncUrl !== false) writeDeepLink(ymd, currentTranslation());
    const actionStatus = $("#action-status");
    if (actionStatus) {
      actionStatus.hidden = true;
      actionStatus.textContent = "";
    }

    $("#reading-date").textContent = ChristoSchedule.formatDisplayDate(ymd);
    updateMeta();

    const weekendEl = $("#weekend-panel");
    const readingEl = $("#reading-panel");
    const beforeEl = $("#before-panel");

    weekendEl.hidden = true;
    readingEl.hidden = true;
    beforeEl.hidden = true;

    if (reading.kind === "weekend") {
      cancelPassageRequest();
      weekendEl.hidden = false;
      $("#weekend-msg").textContent = reading.message;
      renderWeekStrip(ymd);
      return;
    }
    if (reading.kind === "before_start") {
      cancelPassageRequest();
      beforeEl.hidden = false;
      $("#before-msg").textContent = reading.message;
      return;
    }
    if (reading.kind !== "reading") {
      cancelPassageRequest();
      showFatal(reading.message || "Unknown schedule state");
      return;
    }

    readingEl.hidden = false;

    $("#book-badge").textContent = reading.bookLabel;
    $("#passage-ref").textContent = reading.fullRef;
    $("#time-est").textContent = reading.timeEstimate;
    $("#book-focus").textContent = reading.bookFocus;
    const occ = Number(reading.weekdayOccurrence) || 0;
    $("#weekday-progress").textContent = occ
      ? `${reading.weekdayName} ${occ} of this plan`
      : "";
    $("#tomorrow-note").textContent = `Next weekday: ${reading.next.weekdayName} · ${reading.next.bookLabel}`;
    renderYesterdayLine(ymd);
    renderContinueIncomplete(ymd);

    const qList = $("#questions");
    qList.innerHTML = reading.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("");

    // Christ-centered reflection seed (deterministic from ref + book)
    $("#reflection-seed").textContent = buildReflectionSeed(reading);

    const day = ensureDay(ymd);
    $("#journal").value = day.journal || "";
    const tr = $("#translation");
    if (tr) tr.value = state.translation || day.translation || "NIV";
    updateCompleteButton(!!day.completed);

    await loadPassage(seq);
  }

  function buildReflectionSeed(reading) {
    const openers = {
      matthew: "Behold the King who fulfils every promise.",
      mark: "Watch the Servant-Son move with holy urgency toward the cross.",
      luke: "Meet the merciful Savior who seeks and saves the lost.",
      philippians: "Boast only in Christ — joy flows from knowing Him.",
      jude: "Rest in the One who is able to keep you from stumbling.",
    };
    const opener = openers[reading.bookKey] || "Look for Jesus.";
    return `${opener} As you read ${reading.fullRef}, ask: How does this passage reveal His person, work, or gospel glory? End with one short prayer of trust.`;
  }

  async function loadPassage(seq) {
    if (speaking) {
      stopListening();
      announceAction("Stopped reading.");
    }
    const reading = ChristoSchedule.resolveReading(plan, currentYmd);
    if (reading.kind !== "reading") return;

    const body = $("#passage-body");
    const status = $("#passage-status");
    lastPassage = null;
    hideRefPopover();
    body.innerHTML = "";
    status.textContent = "Loading Scripture…";
    status.hidden = false;

    const tr = state.translation || "NIV";
    const previousController = passageController;
    const controller = new AbortController();
    passageController = controller;
    const request = ChristoBible.fetchPassage(reading.bookKey, reading.ref, tr, {
      signal: controller.signal,
    });
    // Subscribe first so same-chapter navigation keeps the shared fetch alive.
    previousController?.abort();
    try {
      const result = await request;
      if (controller.signal.aborted || seq !== renderSeq) return; // user navigated away
      if (!result.verses?.length) throw new Error("Empty passage");
      lastPassage = result;
      body.innerHTML = result.html;
      bindPassageReferences(body);
      status.hidden = true;
      $("#passage-tr-label").textContent = result.translation;
    } catch (err) {
      if (controller.signal.aborted || seq !== renderSeq) return;
      status.hidden = false;
      status.innerHTML = `Could not load live text (${escapeHtml(err.message || "network")}). Open <strong>${escapeHtml(reading.fullRef)}</strong> in your Bible app, or try another translation.`;
      lastPassage = null;
      hideRefPopover();
      body.innerHTML = `<p class="fallback-ref">Read: <strong>${escapeHtml(reading.fullRef)}</strong></p>
        <p class="muted">Live text uses a public API (bolls.life). Offline or blocked networks fall back to the reference only — the schedule still works fully offline once plan data is cached.</p>`;
      $("#passage-tr-label").textContent = "—";
    } finally {
      if (passageController === controller) passageController = null;
    }
  }

  function cancelPassageRequest() {
    const controller = passageController;
    passageController = null;
    controller?.abort();
  }

  function hideRefPopover() {
    previewController?.abort();
    previewController = null;
    const popover = $("#ref-popover");
    if (!popover) return;
    popover.hidden = true;
    popover.removeAttribute("style");
  }

  function placeRefPopover(anchor) {
    const popover = $("#ref-popover");
    if (!popover || !anchor) return;
    const box = anchor.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    let left = box.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;
    let top = box.bottom + 8;
    popover.hidden = false;
    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    const popBox = popover.getBoundingClientRect();
    if (popBox.bottom > window.innerHeight - 8) {
      top = Math.max(8, box.top - popBox.height - 8);
      popover.style.top = `${top}px`;
    }
  }

  function showRefPopover(anchor, title, bodyHtml) {
    const popover = $("#ref-popover");
    const heading = $("#ref-popover-title");
    const body = $("#ref-popover-body");
    if (!popover || !heading || !body) return;
    heading.textContent = title;
    body.innerHTML = bodyHtml;
    placeRefPopover(anchor);
  }

  function verseRecord(chapter, verse) {
    return lastPassage?.verses?.find(
      (item) => Number(item.chapter) === Number(chapter) && Number(item.verse) === Number(verse)
    );
  }

  async function copyVerse(chapter, verse) {
    const reading = plan && currentYmd ? ChristoSchedule.resolveReading(plan, currentYmd) : null;
    const record = verseRecord(chapter, verse);
    if (!record) {
      announceAction("Nothing to copy yet.");
      return;
    }
    const book = reading?.bookLabel || "Passage";
    const ok = await writeClipboard(`${book} ${chapter}:${verse}\n${record.text}`);
    announceAction(ok ? `Copied ${book} ${chapter}:${verse}.` : "Could not copy verse.");
  }

  async function openCrossRef(anchor) {
    const ref = anchor.getAttribute("data-ref") || "";
    const parsed = ChristoBible.parseRemoteRef?.(ref);
    showRefPopover(anchor, parsed?.label || "Reference", `<p class="muted">Loading…</p>`);
    previewController?.abort();
    const controller = new AbortController();
    previewController = controller;
    try {
      const preview = await ChristoBible.fetchVersePreview(ref, { signal: controller.signal });
      if (controller.signal.aborted) return;
      showRefPopover(
        anchor,
        `${preview.label} · ${preview.translation}`,
        `<p>${escapeHtml(preview.text)}</p>`
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      showRefPopover(
        anchor,
        parsed?.label || "Reference",
        `<p class="muted">${escapeHtml(error.message || "Could not load that verse.")}</p>`
      );
    }
  }

  function bindPassageReferences(root) {
    if (!root || root.dataset.refsBound === "1") return;
    root.dataset.refsBound = "1";
    root.addEventListener("click", (event) => {
      const vnum = event.target.closest?.(".vnum");
      if (vnum && root.contains(vnum)) {
        const verseEl = vnum.closest(".verse");
        if (!verseEl) return;
        copyVerse(verseEl.dataset.chapter, verseEl.dataset.verse);
        return;
      }
      const mark = event.target.closest?.(".fn-mark");
      if (mark && root.contains(mark)) {
        const [chapter, verse] = String(mark.getAttribute("data-verse-key") || "").split(":");
        const record = verseRecord(chapter, verse);
        showRefPopover(
          mark,
          `Cross references · ${chapter}:${verse}`,
          record?.commentHtml || "<p class='muted'>No references for this verse.</p>"
        );
        return;
      }
      const link = event.target.closest?.(".xref-link");
      if (link && root.contains(link)) {
        event.preventDefault();
        openCrossRef(link);
      }
    });
  }

  function bindRefPopover() {
    $("#ref-popover")?.addEventListener("click", (event) => {
      const link = event.target.closest?.(".xref-link");
      if (!link) return;
      event.preventDefault();
      openCrossRef(link);
    });
    $("#ref-popover-close")?.addEventListener("click", hideRefPopover);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideRefPopover();
    });
    document.addEventListener("pointerdown", (event) => {
      const popover = $("#ref-popover");
      if (!popover || popover.hidden) return;
      if (popover.contains(event.target)) return;
      if (event.target.closest?.(".fn-mark, .xref-link, .vnum")) return;
      hideRefPopover();
    });
    window.addEventListener("resize", hideRefPopover, { passive: true });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showFatal(msg) {
    const el = $("#fatal");
    if (el) {
      el.hidden = false;
      el.textContent = msg;
    }
  }

  // Expose for tests
  window.ChristoDayApp = { resolve: (ymd) => plan && ChristoSchedule.resolveReading(plan, ymd), getPlan: () => plan };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
