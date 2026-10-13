/** Reference-only four-week calendar snapshots; never reads journal or passage text. */
(function (global) {
  "use strict";

  const DAYS = 28;
  const TRANSLATIONS = new Set(["NIV", "ESV", "NKJV", "WEB"]);
  const READER_URL = "https://alphaeusng.github.io/ChristoDay/";
  const encoder = new TextEncoder();

  function escapeText(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;").replace(/,/g, "\\,")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  }

  function foldLine(value) {
    let line = "";
    let bytes = 0;
    const lines = [];
    for (const character of value) {
      const size = encoder.encode(character).length;
      if (bytes + size > 75) {
        lines.push(line);
        line = " ";
        bytes = 1;
      }
      line += character;
      bytes += size;
    }
    lines.push(line);
    return lines.join("\r\n");
  }

  function range(plan, selectedYmd) {
    if (!ChristoSchedule.validatePlan(plan).ok || !ChristoState.validYmd(selectedYmd)) {
      throw new Error("Choose a valid reading date.");
    }
    const start = selectedYmd < plan.meta.startDate ? plan.meta.startDate : selectedYmd;
    // A four-digit iCalendar DATE needs the exclusive window end in the same supported range.
    if (start > "9999-12-03") throw new Error("Choose an earlier reading date.");
    return { start, end: ChristoSchedule.addDaysYmd(start, DAYS - 1) };
  }

  function build(plan, selectedYmd, translation = "NIV", now = new Date()) {
    const window = range(plan, selectedYmd);
    const tr = TRANSLATIONS.has(translation) ? translation : "NIV";
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const dateValue = (ymd) => ymd.replace(/-/g, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ChristoDay//Reading Plan//EN", "CALSCALE:GREGORIAN"];
    let count = 0;
    for (let offset = 0; offset < DAYS; offset++) {
      const ymd = ChristoSchedule.addDaysYmd(window.start, offset);
      const reading = ChristoSchedule.resolveReading(plan, ymd);
      if (reading.kind !== "reading") continue;
      const url = new URL(READER_URL);
      url.searchParams.set("d", ymd);
      url.searchParams.set("tr", tr);
      lines.push(
        "BEGIN:VEVENT",
        `UID:christoday-${dateValue(plan.meta.startDate)}-${dateValue(ymd)}@alphaeusng.github.io`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dateValue(ymd)}`,
        `DTEND;VALUE=DATE:${dateValue(ChristoSchedule.addDaysYmd(ymd, 1))}`,
        `SUMMARY:${escapeText(`ChristoDay: ${reading.fullRef}`)}`,
        `DESCRIPTION:${escapeText(`Read ${reading.fullRef}. Dates follow the Asia/Singapore reading plan. Open the reading: ${url.href}`)}`,
        `URL:${url.href}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      );
      count++;
    }
    lines.push("END:VCALENDAR");
    return {
      ...window,
      count,
      filename: `christoday-readings-${window.start}-to-${window.end}.ics`,
      text: `${lines.map(foldLine).join("\r\n")}\r\n`,
    };
  }

  function create(deps) {
    const $ = deps.$;
    function setStatus(message) {
      const status = $("#calendar-status");
      if (status) { status.hidden = !message; status.textContent = message; }
    }
    function refresh() {
      const card = $("#reading-calendar");
      if (card) card.hidden = false;
      try {
        const window = range(deps.getPlan(), deps.getCurrentYmd());
        $("#calendar-range").textContent = `${window.start} to ${window.end} · Weekday references and reading links. All-day dates follow the Singapore plan.`;
        $("#btn-calendar").disabled = false;
      } catch (error) {
        $("#calendar-range").textContent = error.message;
        $("#btn-calendar").disabled = true;
      }
      setStatus("");
    }
    function download() {
      let objectUrl;
      let link;
      try {
        const result = build(deps.getPlan(), deps.getCurrentYmd(), deps.getTranslation());
        objectUrl = URL.createObjectURL(new Blob([result.text], { type: "text/calendar;charset=utf-8" }));
        link = document.createElement("a");
        link.href = objectUrl;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        setStatus(`Downloaded ${result.count} reading dates. Import the file into your calendar.`);
      } catch {
        setStatus("Could not download a calendar on this device. Try again.");
      } finally {
        link?.remove();
        if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      }
    }
    function bind() { $("#btn-calendar")?.addEventListener("click", download); }
    return { bind, refresh };
  }

  global.ChristoCalendar = { build, range, create };
})(typeof window !== "undefined" ? window : globalThis);
