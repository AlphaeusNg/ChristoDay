/**
 * Gospel cross-reference popovers and verse copy.
 * Live reference text is fetched on demand and is not stored.
 */
(function (global) {
  "use strict";

  function create(deps) {
    const $ = deps.$;
    let previewController = null;

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function hide() {
      previewController?.abort();
      previewController = null;
      const popover = $("#ref-popover");
      if (!popover) return;
      popover.hidden = true;
      popover.removeAttribute("style");
    }

    function place(anchor) {
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

    function show(anchor, title, bodyHtml) {
      const popover = $("#ref-popover");
      const heading = $("#ref-popover-title");
      const body = $("#ref-popover-body");
      if (!popover || !heading || !body) return;
      heading.textContent = title;
      body.innerHTML = bodyHtml;
      place(anchor);
    }

    function verseRecord(chapter, verse) {
      return deps.getLastPassage()?.verses?.find(
        (item) => Number(item.chapter) === Number(chapter) && Number(item.verse) === Number(verse)
      );
    }

    async function copyVerse(chapter, verse) {
      const plan = deps.getPlan();
      const ymd = deps.getCurrentYmd();
      const reading = plan && ymd ? ChristoSchedule.resolveReading(plan, ymd) : null;
      const record = verseRecord(chapter, verse);
      if (!record) {
        deps.announceAction("Nothing to copy yet.");
        return;
      }
      const book = reading?.bookLabel || "Passage";
      const ok = await deps.writeClipboard(`${book} ${chapter}:${verse}\n${record.text}`);
      deps.announceAction(ok ? `Copied ${book} ${chapter}:${verse}.` : "Could not copy verse.");
    }

    async function openCrossRef(anchor) {
      const ref = anchor.getAttribute("data-ref") || "";
      const parsed = ChristoBible.parseRemoteRef?.(ref);
      show(anchor, parsed?.label || "Reference", `<p class="muted">Loading…</p>`);
      previewController?.abort();
      const controller = new AbortController();
      previewController = controller;
      try {
        const preview = await ChristoBible.fetchVersePreview(ref, { signal: controller.signal });
        if (controller.signal.aborted) return;
        show(
          anchor,
          `${preview.label} · ${preview.translation}`,
          `<p>${escapeHtml(preview.text)}</p>`
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        show(
          anchor,
          parsed?.label || "Reference",
          `<p class="muted">${escapeHtml(error.message || "Could not load that verse.")}</p>`
        );
      }
    }

    function bindPassage(root) {
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
          show(
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

    function bind() {
      $("#ref-popover")?.addEventListener("click", (event) => {
        const link = event.target.closest?.(".xref-link");
        if (!link) return;
        event.preventDefault();
        openCrossRef(link);
      });
      $("#ref-popover-close")?.addEventListener("click", hide);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hide();
      });
      document.addEventListener("pointerdown", (event) => {
        const popover = $("#ref-popover");
        if (!popover || popover.hidden) return;
        if (popover.contains(event.target)) return;
        if (event.target.closest?.(".fn-mark, .xref-link, .vnum")) return;
        hide();
      });
      window.addEventListener("resize", hide, { passive: true });
    }

    return { bind, bindPassage, hide };
  }

  global.ChristoRefPopover = { create };
})(typeof window !== "undefined" ? window : globalThis);
