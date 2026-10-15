/** Reference-only four-week paper checklists; never reads journal or passage text. */
(function (global) {
  "use strict";

  const DAYS = 28;

  function range(plan, selectedYmd) {
    if (!ChristoSchedule.validatePlan(plan).ok || !ChristoState.validYmd(selectedYmd)) {
      throw new Error("Choose a valid reading date.");
    }
    const start = selectedYmd < plan.meta.startDate ? plan.meta.startDate : selectedYmd;
    // Match the calendar export: a four-digit DATE window cannot start after this day.
    if (start > "9999-12-03") throw new Error("Choose an earlier reading date.");
    return { start, end: ChristoSchedule.addDaysYmd(start, DAYS - 1) };
  }

  function build(plan, selectedYmd) {
    const window = range(plan, selectedYmd);
    const entries = [];
    for (let offset = 0; offset < DAYS; offset++) {
      const date = ChristoSchedule.addDaysYmd(window.start, offset);
      const reading = ChristoSchedule.resolveReading(plan, date);
      if (reading.kind !== "reading") continue;
      entries.push({
        date,
        weekday: reading.weekdayName,
        book: reading.bookLabel,
        reference: reading.fullRef,
      });
    }
    return { ...window, count: entries.length, entries };
  }

  function create(deps) {
    const $ = deps.$;
    function setStatus(message) {
      const status = $("#checklist-status");
      if (status) {
        status.hidden = !message;
        status.textContent = message;
      }
    }
    function render(result) {
      const section = $("#reading-checklist-print");
      if (!section) return;
      section.replaceChildren();
      const title = document.createElement("h1");
      title.className = "checklist-title";
      title.textContent = "ChristoDay reading checklist";
      const rangeText = document.createElement("p");
      rangeText.className = "checklist-range";
      rangeText.textContent = `${result.start} to ${result.end}`;
      const list = document.createElement("ol");
      list.className = "checklist-rows";
      for (const entry of result.entries) {
        const row = document.createElement("li");
        row.className = "checklist-row";
        const box = document.createElement("span");
        box.className = "checklist-box";
        box.setAttribute("aria-hidden", "true");
        const text = document.createElement("span");
        text.className = "checklist-entry";
        text.textContent = `${entry.date} ${entry.weekday} ${entry.reference}`;
        row.append(box, text);
        list.append(row);
      }
      section.append(title, rangeText, list);
    }
    function refresh() {
      try {
        const result = build(deps.getPlan(), deps.getCurrentYmd());
        render(result);
        $("#checklist-range").textContent = `${result.start} to ${result.end} · Weekday references only. Weekends stay off the page.`;
        $("#btn-checklist").disabled = false;
      } catch (error) {
        $("#checklist-range").textContent = error.message;
        $("#btn-checklist").disabled = true;
      }
      setStatus("");
    }
    function printChecklist() {
      try {
        render(build(deps.getPlan(), deps.getCurrentYmd()));
        window.print();
      } catch {
        setStatus("Could not prepare a checklist on this device. Try again.");
      }
    }
    function bind() {
      $("#btn-checklist")?.addEventListener("click", printChecklist);
      window.addEventListener("beforeprint", () => {
        try {
          render(build(deps.getPlan(), deps.getCurrentYmd()));
        } catch {
          /* Keep the checklist from the last successful refresh. */
        }
      });
    }
    return { bind, refresh };
  }

  global.ChristoChecklist = { build, range, create };
})(typeof window !== "undefined" ? window : globalThis);
