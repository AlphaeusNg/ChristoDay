/**
 * Passage copy, share, speech, type size, focus, and line spacing.
 * Speech callbacks are ignored once a newer reading replaces them.
 */
(function (global) {
  "use strict";

  const PASSAGE_SIZES = ["sm", "md", "lg"];
  const LINE_SPACINGS = ["tight", "normal", "open"];

  function create(deps) {
    const $ = deps.$;
    let speaking = false;
    let speechRun = 0;
    let actionStatusTimer = 0;

    function state() {
      return deps.getState();
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
      const passage = deps.getLastPassage();
      const body = passage?.verses?.length
        ? passage.verses.map((verse) => `${verse.chapter}:${verse.verse} ${verse.text}`).join(" ")
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

    function readingHidden() {
      const readingEl = $("#reading-panel");
      return !readingEl || readingEl.hidden;
    }

    function passageBusy() {
      return $("#passage-body")?.getAttribute("aria-busy") === "true";
    }

    async function copyVisiblePassage() {
      if (readingHidden()) return;
      if (passageBusy()) {
        announceAction("Passage is still updating.");
        return;
      }
      const text = visiblePassageText();
      if (!text) {
        announceAction("Nothing to copy yet.");
        return;
      }
      const ok = await writeClipboard(text);
      announceAction(ok ? "Copied passage." : "Could not copy passage.");
    }

    function applyShareNotePreference(on) {
      state().includeShareNote = on === true;
      const box = $("#include-share-note");
      if (box) box.checked = state().includeShareNote;
      return state().includeShareNote;
    }

    function shareLine(url) {
      const ymd = deps.getCurrentYmd();
      const display = ymd ? ChristoSchedule.formatDisplayDate(ymd) : "";
      const plan = deps.getPlan();
      const reading = plan && ymd ? ChristoSchedule.resolveReading(plan, ymd) : null;
      const ref = reading?.kind === "reading"
        ? reading.fullRef
        : ($("#passage-ref")?.textContent || "").trim();
      const line = [display, ref, url].filter(Boolean).join(" · ");
      const note = state().includeShareNote ? deps.getJournalNote() : "";
      return note ? `${line}\n\n${note}` : line;
    }

    async function shareReading() {
      if (passageBusy()) {
        announceAction("Passage is still updating.");
        return;
      }
      const ymd = deps.getCurrentYmd();
      deps.writeDeepLink(ymd, deps.currentTranslation());
      const url = location.href;
      const line = shareLine(url);
      const plan = deps.getPlan();
      const reading = plan && ymd ? ChristoSchedule.resolveReading(plan, ymd) : null;
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

    function applyPassageSize(size) {
      const next = ChristoState.validPassageSize
        ? ChristoState.validPassageSize(size)
        : size === "sm" || size === "lg"
          ? size
          : "md";
      state().passageSize = next;
      document.documentElement.setAttribute("data-passage-size", next);
      const smaller = $("#btn-type-smaller");
      const larger = $("#btn-type-larger");
      if (smaller) smaller.disabled = next === "sm";
      if (larger) larger.disabled = next === "lg";
      return next;
    }

    function shiftPassageSize(delta) {
      const current = applyPassageSize(state().passageSize);
      const index = PASSAGE_SIZES.indexOf(current);
      const next = PASSAGE_SIZES[Math.max(0, Math.min(PASSAGE_SIZES.length - 1, index + delta))];
      if (next === current) return;
      applyPassageSize(next);
      deps.saveState();
      announceAction(
        next === "sm" ? "Smaller passage text." : next === "lg" ? "Larger passage text." : "Default passage text."
      );
    }

    function applyLineSpacing(spacing) {
      const next = ChristoState.validLineSpacing
        ? ChristoState.validLineSpacing(spacing)
        : spacing === "tight" || spacing === "open"
          ? spacing
          : "normal";
      state().lineSpacing = next;
      document.documentElement.setAttribute("data-line-spacing", next);
      const tighter = $("#btn-leading-tighter");
      const looser = $("#btn-leading-looser");
      if (tighter) tighter.disabled = next === "tight";
      if (looser) looser.disabled = next === "open";
      return next;
    }

    function shiftLineSpacing(delta) {
      const current = applyLineSpacing(state().lineSpacing);
      const index = LINE_SPACINGS.indexOf(current);
      const next = LINE_SPACINGS[Math.max(0, Math.min(LINE_SPACINGS.length - 1, index + delta))];
      if (next === current) return;
      applyLineSpacing(next);
      deps.saveState();
      announceAction(
        next === "tight"
          ? "Tighter line spacing."
          : next === "open"
            ? "Looser line spacing."
            : "Default line spacing."
      );
    }

    function applyFocus(on) {
      const enabled = on === true;
      state().readingFocus = enabled;
      const root = document.documentElement;
      if (enabled) root.setAttribute("data-reading-focus", "on");
      else root.removeAttribute("data-reading-focus");
      const tools = $("#reading-tools");
      if (tools instanceof HTMLDetailsElement) tools.open = !enabled;
      const button = $("#btn-focus");
      if (button) button.setAttribute("aria-pressed", enabled ? "true" : "false");
      return enabled;
    }

    function toggleFocus() {
      applyFocus(!state().readingFocus);
      deps.saveState();
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
      speechRun += 1;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      renderListeningState(false);
    }

    function finishListening(run, errorMessage = "") {
      if (run !== speechRun) return;
      speechRun += 1;
      renderListeningState(false);
      if (errorMessage) announceAction(errorMessage);
    }

    function toggleListen() {
      if (readingHidden()) return;
      if (passageBusy()) {
        announceAction("Passage is still updating.");
        return;
      }
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
      const run = speechRun;
      const utterance = new window.SpeechSynthesisUtterance();
      utterance.text = text;
      utterance.rate = 0.92;
      utterance.onend = () => {
        finishListening(run);
      };
      utterance.onerror = () => {
        finishListening(run, "Could not read passage.");
      };
      renderListeningState(true);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finishListening(run, "Could not read passage.");
        return;
      }
      if (run === speechRun && speaking) announceAction("Reading aloud…");
    }

    function bind() {
      $("#btn-copy")?.addEventListener("click", () => {
        copyVisiblePassage().catch(() => {});
      });
      $("#btn-listen")?.addEventListener("click", () => {
        toggleListen();
      });
      $("#btn-share")?.addEventListener("click", () => {
        shareReading().catch(() => {});
      });
      $("#include-share-note")?.addEventListener("change", (event) => {
        applyShareNotePreference(event.target.checked);
        deps.saveState();
      });
      $("#btn-type-smaller")?.addEventListener("click", () => shiftPassageSize(-1));
      $("#btn-type-larger")?.addEventListener("click", () => shiftPassageSize(1));
      $("#btn-leading-tighter")?.addEventListener("click", () => shiftLineSpacing(-1));
      $("#btn-leading-looser")?.addEventListener("click", () => shiftLineSpacing(1));
      $("#btn-focus")?.addEventListener("click", toggleFocus);
    }

    return {
      bind,
      announceAction,
      writeClipboard,
      copyVisiblePassage,
      shareReading,
      applyPassageSize,
      shiftPassageSize,
      applyLineSpacing,
      shiftLineSpacing,
      applyFocus,
      applyShareNotePreference,
      toggleListen,
      stopListening,
      isSpeaking: () => speaking,
    };
  }

  global.ChristoReadingActions = { create, PASSAGE_SIZES, LINE_SPACINGS };
})(typeof window !== "undefined" ? window : globalThis);
