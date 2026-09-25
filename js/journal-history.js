/**
 * On-device journal search. Filters never leave the browser.
 */
(function (global) {
  "use strict";

  function searchEntries(entries, filters = {}) {
    const query = String(filters.query || "").trim().toLowerCase();
    const from = typeof filters.from === "string" ? filters.from : "";
    const to = typeof filters.to === "string" ? filters.to : "";
    const book = typeof filters.book === "string" ? filters.book : "";
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => {
        const note = typeof entry?.journal === "string" ? entry.journal.trim() : "";
        if (!note) return false;
        if (from && entry.ymd < from) return false;
        if (to && entry.ymd > to) return false;
        if (book && entry.bookKey !== book) return false;
        if (!query) return true;
        return note.toLowerCase().includes(query);
      })
      .sort((a, b) => (a.ymd < b.ymd ? 1 : a.ymd > b.ymd ? -1 : 0));
  }

  function create(deps) {
    const $ = deps.$;

    function readFilters() {
      return {
        query: $("#history-query")?.value || "",
        from: $("#history-from")?.value || "",
        to: $("#history-to")?.value || "",
        book: $("#history-book")?.value || "",
      };
    }

    function refresh() {
      const results = searchEntries(deps.getEntries(), readFilters());
      const list = $("#history-results");
      const status = $("#history-status");
      if (status) {
        status.textContent = results.length
          ? `${results.length} saved note${results.length === 1 ? "" : "s"}.`
          : "No notes match.";
      }
      if (!list) return results;
      list.replaceChildren();
      for (const entry of results) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn history-result";
        button.dataset.ymd = entry.ymd;
        const title = document.createElement("span");
        title.className = "history-result-title";
        const when = ChristoSchedule.formatDisplayDate(entry.ymd);
        const where = entry.ref || entry.bookLabel || "Reading";
        title.textContent = entry.completed ? `${when} · ${where} · completed` : `${when} · ${where}`;
        const preview = document.createElement("span");
        preview.className = "history-result-note";
        preview.textContent = entry.journal.trim().slice(0, 180);
        button.append(title, preview);
        button.addEventListener("click", () => deps.openReading(entry.ymd));
        item.append(button);
        list.append(item);
      }
      return results;
    }

    function setBooks(books) {
      const select = $("#history-book");
      if (!select) return;
      const current = select.value;
      select.replaceChildren();
      const all = document.createElement("option");
      all.value = "";
      all.textContent = "All books";
      select.append(all);
      for (const book of books || []) {
        if (!book?.key) continue;
        const option = document.createElement("option");
        option.value = book.key;
        option.textContent = book.label || book.key;
        select.append(option);
      }
      if ([...select.options].some((option) => option.value === current)) select.value = current;
    }

    function bind() {
      for (const id of ["#history-query", "#history-from", "#history-to", "#history-book"]) {
        const el = $(id);
        el?.addEventListener("input", refresh);
        el?.addEventListener("change", refresh);
      }
    }

    return { bind, refresh, setBooks };
  }

  global.ChristoJournalHistory = { searchEntries, create };
})(typeof window !== "undefined" ? window : globalThis);
