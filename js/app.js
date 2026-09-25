/**
 * ChristoDay — daily Christ-centered gospel reading app.
 */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);

  const TRANSLATIONS = new Set(["NIV", "ESV", "NKJV", "WEB"]);

  let plan = null;
  let state = ChristoState.loadState();
  let readings = ChristoReadings.load();
  let currentYmd = null;
  let observedToday = null;
  /** Monotonic token so slow Bible fetches don't clobber a newer day. */
  let renderSeq = 0;
  let passageController = null;
  let nextPassageController = null;
  let lastPassage = null;
  let passageSource = "reference";
  let actions = null;
  let backups = null;
  let popovers = null;
  let journalHistory = null;

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

  function currentJournalNote() {
    const fromState = String(state.days?.[currentYmd]?.journal || "").trim();
    if (fromState) return fromState;
    return String($("#journal")?.value || "").trim();
  }

  function journalEntries() {
    const entries = [];
    for (const [ymd, day] of Object.entries(state.days || {})) {
      const journal = typeof day?.journal === "string" ? day.journal : "";
      if (!journal.trim() || !ChristoState.validYmd(ymd)) continue;
      let bookKey = "";
      let bookLabel = "Reading";
      let ref = "";
      if (plan) {
        const reading = ChristoSchedule.resolveReading(plan, ymd);
        if (reading.kind === "reading") {
          bookKey = reading.bookKey;
          bookLabel = reading.bookLabel;
          ref = reading.fullRef;
        } else if (reading.kind === "weekend") {
          bookLabel = "Weekend";
        }
      }
      entries.push({
        ymd,
        journal,
        bookKey,
        bookLabel,
        ref,
        completed: day.completed === true,
      });
    }
    return entries;
  }

  function historyBooks() {
    const books = [];
    const seen = new Set();
    for (const key of Object.values(plan?.weekdayMap || {})) {
      if (seen.has(key) || !plan?.books?.[key]) continue;
      seen.add(key);
      books.push({ key, label: plan.books[key].label || key });
    }
    return books;
  }

  function initModules() {
    actions = ChristoReadingActions.create({
      $,
      getState: () => state,
      saveState,
      getLastPassage: () => lastPassage,
      getPlan: () => plan,
      getCurrentYmd: () => currentYmd,
      getJournalNote: currentJournalNote,
      writeDeepLink,
      currentTranslation,
    });
    popovers = ChristoRefPopover.create({
      $,
      getLastPassage: () => lastPassage,
      getPlan: () => plan,
      getCurrentYmd: () => currentYmd,
      announceAction: (message) => actions.announceAction(message),
      writeClipboard: (text) => actions.writeClipboard(text),
    });
    backups = ChristoJournalBackup.create({
      $,
      getState: () => state,
      getPlan: () => plan,
      getCurrentYmd: () => currentYmd,
      replaceState: (next) => {
        state = next;
      },
      saveState,
      renderDay,
      applyPassageSize: (size) => actions.applyPassageSize(size),
      applyLineSpacing: (spacing) => actions.applyLineSpacing(spacing),
      applyFocus: (on) => actions.applyFocus(on),
      applyShareNotePreference: (on) => actions.applyShareNotePreference(on),
    });
    journalHistory = ChristoJournalHistory.create({
      $,
      getEntries: journalEntries,
      openReading: (ymd) => openHistoryReading(ymd),
    });
  }

  async function init() {
    bindAutoHideHeader();
    initModules();
    popovers.bind();
    try {
      const res = await fetch("data/segments.json");
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
    observedToday = ChristoSchedule.partsInSingapore().ymd;
    currentYmd = ChristoState.validYmd(requestedYmd)
      ? requestedYmd
      : observedToday;
    bindUi();
    actions.applyPassageSize(state.passageSize);
    actions.applyLineSpacing(state.lineSpacing);
    actions.applyFocus(state.readingFocus);
    actions.applyShareNotePreference(state.includeShareNote);
    const historyCard = $("#journal-history");
    if (historyCard) historyCard.hidden = false;
    journalHistory.setBooks(historyBooks());
    journalHistory.bind();
    await renderDay(currentYmd, { syncUrl: hadDeepLink });
    journalHistory.refresh();
    watchSingaporeDay();
    $("#site-version").textContent = SITE_VERSION?.id || "";
  }

  function bindUi() {
    actions.bind();
    backups.bind();
    $("#btn-prev")?.addEventListener("click", () => shiftDay(-1));
    $("#btn-next")?.addEventListener("click", () => shiftDay(1));
    $("#btn-today")?.addEventListener("click", () => renderDay(ChristoSchedule.partsInSingapore().ymd));
    $("#btn-continue-incomplete")?.addEventListener("click", () => {
      const ymd = $("#btn-continue-incomplete")?.dataset.ymd;
      if (ymd) renderDay(ymd);
    });
    $("#btn-complete")?.addEventListener("click", toggleComplete);
    $("#btn-save-reading")?.addEventListener("click", saveCurrentReading);
    $("#btn-remove-reading")?.addEventListener("click", removeCurrentReading);
    $("#journal")?.addEventListener("input", (e) => {
      const day = ensureDay(currentYmd);
      day.journal = e.target.value;
      saveState();
      updateMeta();
      journalHistory.refresh();
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
        actions.copyVisiblePassage().catch(() => {});
      }
      if ((e.key === "l" || e.key === "L") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        actions.toggleListen();
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        actions.shiftPassageSize(-1);
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        actions.shiftPassageSize(1);
      }
    });
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
    journalHistory?.refresh();
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
    const today = observedToday || ChristoSchedule.partsInSingapore().ymd;
    $("#stat-streak").textContent = String(computeStreak(today));
    $("#stat-done").textContent = String(countCompleted());
  }

  function applyTodayLabels() {
    const today = observedToday || ChristoSchedule.partsInSingapore().ymd;
    const dateEl = $("#reading-date");
    if (dateEl && currentYmd) {
      const display = ChristoSchedule.formatDisplayDate(currentYmd);
      dateEl.textContent = currentYmd === today ? `Today · ${display}` : display;
    }
    const heading = $("#journal-heading");
    if (heading) {
      heading.textContent = currentYmd === today ? "One sentence for today" : "One sentence for this reading";
    }
    updateMeta();
  }

  function journalIsActive() {
    const journal = $("#journal");
    return !!journal && document.activeElement === journal;
  }

  function handleTodayChange(nextToday) {
    const decision = ChristoToday.decideTodayRollover({
      viewedYmd: currentYmd,
      previousToday: observedToday,
      nextToday,
      journalActive: journalIsActive(),
    });
    observedToday = nextToday;
    if (decision.moved) return renderDay(decision.viewedYmd);
    applyTodayLabels();
    return decision;
  }

  function watchSingaporeDay() {
    const tick = () => {
      const next = ChristoSchedule.partsInSingapore().ymd;
      if (next !== observedToday) handleTodayChange(next);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tick();
    });
    window.addEventListener("focus", tick);
    window.setInterval(tick, 60000);
  }

  async function openHistoryReading(ymd) {
    await renderDay(ymd);
    $("#journal")?.scrollIntoView({ block: "center", inline: "nearest" });
  }

  async function renderDay(ymd, options = {}) {
    const seq = ++renderSeq;
    currentYmd = ymd;
    actions?.stopListening();
    const reading = ChristoSchedule.resolveReading(plan, ymd);
    const datePick = $("#date-pick");
    if (datePick) datePick.value = ymd;
    if (options.syncUrl !== false) writeDeepLink(ymd, currentTranslation());
    const actionStatus = $("#action-status");
    if (actionStatus) {
      actionStatus.hidden = true;
      actionStatus.textContent = "";
    }

    applyTodayLabels();

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
      journalHistory?.refresh();
      return;
    }
    if (reading.kind === "before_start") {
      cancelPassageRequest();
      beforeEl.hidden = false;
      $("#before-msg").textContent = reading.message;
      journalHistory?.refresh();
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
    journalHistory?.refresh();

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

  function refreshReadingAvailability(loaded) {
    const tr = currentTranslation();
    const saved = !!ChristoReadings.get(readings, currentYmd, tr);
    const status = ChristoReadings.availability({ translation: tr, saved, loaded });
    const el = $("#passage-availability");
    if (el) el.textContent = status.text;
    const saveBtn = $("#btn-save-reading");
    const removeBtn = $("#btn-remove-reading");
    const busy = $("#passage-body")?.getAttribute("aria-busy") === "true";
    if (saveBtn) {
      saveBtn.hidden = !(status.permitted && !status.saved && loaded === "live");
      saveBtn.disabled = busy;
    }
    if (removeBtn) removeBtn.hidden = !status.saved;
  }

  function saveCurrentReading() {
    const tr = currentTranslation();
    if (!ChristoBible.allowsLocalPassageStorage(tr)) {
      actions.announceAction(`${tr} text is not stored. Offline, this reading stays reference-only.`);
      return;
    }
    const reading = ChristoSchedule.resolveReading(plan, currentYmd);
    if (reading.kind !== "reading" || !lastPassage?.verses?.length || lastPassage.translation !== tr) {
      actions.announceAction("Nothing to save yet.");
      return;
    }
    const entry = {
      ymd: currentYmd,
      translation: tr,
      ref: reading.fullRef,
      bookKey: reading.bookKey,
      bookLabel: reading.bookLabel,
      savedAt: new Date().toISOString(),
      passage: {
        translation: tr,
        verses: lastPassage.verses.map((verse) => ({
          chapter: verse.chapter,
          verse: verse.verse,
          text: verse.text,
          heading: verse.heading || "",
        })),
      },
    };
    const result = ChristoReadings.put(readings, entry);
    if (!result.ok) {
      const message = result.reason === "full"
        ? "Offline reading storage is full. Remove a saved reading first."
        : result.reason === "not-permitted"
          ? `${tr} text is not stored. Offline, this reading stays reference-only.`
          : "Could not save this reading.";
      actions.announceAction(message);
      return;
    }
    if (!ChristoReadings.save(result.library)) {
      actions.announceAction("Could not save on this device.");
      return;
    }
    readings = result.library;
    refreshReadingAvailability(passageSource === "saved" ? "saved" : "live");
    actions.announceAction(`Saved this ${tr} reading on this device.`);
  }

  function showReferenceOnly(reading, message) {
    const body = $("#passage-body");
    const status = $("#passage-status");
    lastPassage = null;
    passageSource = "reference";
    popovers?.hide();
    status.hidden = false;
    status.innerHTML = message;
    body.innerHTML = `<p class="fallback-ref">Read: <strong>${escapeHtml(reading.fullRef)}</strong></p>
        <p class="muted">Live text uses a public API (bolls.life). Offline or blocked networks fall back to the reference only — the schedule still works fully offline once plan data is cached.</p>`;
    setPassagePending(false);
    $("#passage-tr-label").textContent = "—";
    refreshReadingAvailability("reference");
  }

  function removeCurrentReading() {
    const tr = currentTranslation();
    const next = ChristoReadings.remove(readings, currentYmd, tr);
    if (!ChristoReadings.save(next)) {
      actions.announceAction("Could not remove the saved reading.");
      return;
    }
    readings = next;
    if (passageSource === "saved") {
      const reading = ChristoSchedule.resolveReading(plan, currentYmd);
      showReferenceOnly(
        reading,
        `Saved copy removed. Open <strong>${escapeHtml(reading.fullRef)}</strong> when you are online, or read it in your Bible.`
      );
    } else {
      refreshReadingAvailability(passageSource === "live" ? "live" : "reference");
    }
    actions.announceAction("Removed the saved reading.");
  }

  function paintSavedPassage(reading, tr) {
    const savedEntry = ChristoReadings.get(readings, currentYmd, tr);
    if (!savedEntry || !ChristoBible.allowsLocalPassageStorage(tr)) return false;
    const rendered = ChristoBible.renderStoredVerses(
      savedEntry.bookKey || reading.bookKey,
      savedEntry.passage.verses
    );
    if (!rendered.verses.length) return false;
    const body = $("#passage-body");
    const status = $("#passage-status");
    lastPassage = { ...rendered, translation: tr };
    passageSource = "saved";
    body.innerHTML = rendered.html;
    popovers.bindPassage(body);
    setPassagePending(false);
    status.hidden = true;
    $("#passage-tr-label").textContent = tr;
    refreshReadingAvailability("saved");
    return true;
  }

  async function loadPassage(seq) {
    if (actions?.isSpeaking()) {
      actions.stopListening();
      actions.announceAction("Stopped reading.");
    }
    const reading = ChristoSchedule.resolveReading(plan, currentYmd);
    if (reading.kind !== "reading") return;

    const body = $("#passage-body");
    const status = $("#passage-status");
    const hadPaintedPassage = !!body.innerHTML.trim();
    popovers?.hide();
    setPassagePending(true);
    // Stale-while-revalidate: keep last good HTML painted while the next fetch runs.
    if (hadPaintedPassage) {
      status.textContent = "Updating…";
      status.hidden = false;
    } else {
      lastPassage = null;
      passageSource = "reference";
      body.innerHTML = "";
      status.textContent = "Loading Scripture…";
      status.hidden = false;
    }
    refreshReadingAvailability("pending");

    const tr = state.translation || "NIV";
    const previousController = passageController;
    const previousPrefetchController = nextPassageController;
    const controller = new AbortController();
    passageController = controller;
    nextPassageController = null;
    const request = ChristoBible.fetchPassage(reading.bookKey, reading.ref, tr, {
      signal: controller.signal,
    });
    // Subscribe first so same-chapter navigation keeps the shared fetch alive.
    previousController?.abort();
    previousPrefetchController?.abort();
    try {
      const result = await request;
      if (controller.signal.aborted || seq !== renderSeq) return; // user navigated away
      if (!result.verses?.length) throw new Error("Empty passage");
      lastPassage = result;
      passageSource = "live";
      body.innerHTML = result.html;
      popovers.bindPassage(body);
      setPassagePending(false);
      status.hidden = true;
      $("#passage-tr-label").textContent = result.translation;
      refreshReadingAvailability("live");
      prefetchNextReading(reading, tr, seq);
    } catch (err) {
      if (controller.signal.aborted || seq !== renderSeq) return;
      if (paintSavedPassage(reading, tr)) return;
      status.hidden = false;
      status.innerHTML = `Could not load live text (${escapeHtml(err.message || "network")}). Open <strong>${escapeHtml(reading.fullRef)}</strong> in your Bible app, or try another translation.`;
      lastPassage = null;
      passageSource = "reference";
      popovers?.hide();
      body.innerHTML = `<p class="fallback-ref">Read: <strong>${escapeHtml(reading.fullRef)}</strong></p>
        <p class="muted">Live text uses a public API (bolls.life). Offline or blocked networks fall back to the reference only — the schedule still works fully offline once plan data is cached.</p>`;
      setPassagePending(false);
      $("#passage-tr-label").textContent = "—";
      refreshReadingAvailability("reference");
    } finally {
      if (passageController === controller) passageController = null;
    }
  }

  function prefetchNextReading(reading, translation, seq) {
    const nextReading = ChristoSchedule.resolveReading(plan, reading?.next?.ymd);
    if (nextReading.kind !== "reading" || seq !== renderSeq) return;
    const controller = new AbortController();
    nextPassageController = controller;
    ChristoBible.fetchPassage(
      nextReading.bookKey,
      nextReading.ref,
      translation,
      { signal: controller.signal }
    ).catch(() => {
      // Speculative failures stay silent; the normal reading path owns recovery.
    }).finally(() => {
      if (nextPassageController === controller) nextPassageController = null;
    });
  }

  function cancelPassageRequest() {
    const controller = passageController;
    const prefetchController = nextPassageController;
    passageController = null;
    nextPassageController = null;
    controller?.abort();
    prefetchController?.abort();
  }

  function setPassagePending(pending) {
    const body = $("#passage-body");
    if (body) {
      body.setAttribute("aria-busy", pending ? "true" : "false");
      body.toggleAttribute("inert", pending);
    }
    ["#btn-copy", "#btn-listen", "#btn-share"].forEach((selector) => {
      const button = $(selector);
      if (button) button.disabled = pending;
    });
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
  window.ChristoDayApp = {
    resolve: (ymd) => plan && ChristoSchedule.resolveReading(plan, ymd),
    getPlan: () => plan,
    getViewedYmd: () => currentYmd,
    handleTodayChange,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
