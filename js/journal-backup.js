/**
 * Private journal backup download and confirmed restore.
 * The file stays on device; nothing is uploaded.
 */
(function (global) {
  "use strict";

  function create(deps) {
    const $ = deps.$;

    function setBackupStatus(message) {
      const status = $("#backup-status");
      if (!status) return;
      status.hidden = !message;
      status.textContent = message;
    }

    function downloadBackup() {
      try {
        const state = deps.getState();
        const currentYmd = deps.getCurrentYmd();
        const payload = `${JSON.stringify(ChristoState.createBackup(state, undefined, currentYmd), null, 2)}\n`;
        const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `christoday-backup-${ChristoSchedule.partsInSingapore().ymd}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        setBackupStatus("Backup downloaded.");
      } catch {
        setBackupStatus("Could not create a backup on this device.");
      }
    }

    async function restoreBackupFile(file) {
      if (file.size > ChristoState.MAX_BACKUP_BYTES) {
        setBackupStatus("That backup is too large.");
        return;
      }

      let restored;
      try {
        restored = ChristoState.parseBackup(await file.text());
      } catch (error) {
        setBackupStatus(error?.message || "Could not read that backup.");
        return;
      }

      const confirmed = window.confirm(
        "Replace this device's ChristoDay journal and completion history with this backup?"
      );
      if (!confirmed) {
        setBackupStatus("Restore cancelled. Your journal was not changed.");
        return;
      }

      deps.replaceState(restored);
      const state = deps.getState();
      deps.applyPassageSize(state.passageSize);
      deps.applyLineSpacing(state.lineSpacing);
      deps.applyFocus(state.readingFocus);
      deps.applyShareNotePreference(state.includeShareNote);
      const persisted = deps.saveState();
      const todayYmd = ChristoSchedule.partsInSingapore().ymd;
      const openYmd = ChristoState.restoreOpenYmd(
        restored,
        todayYmd,
        (ymd) => deps.getPlan() && ChristoSchedule.resolveReading(deps.getPlan(), ymd).kind === "reading"
      );
      await deps.renderDay(openYmd);
      setBackupStatus(
        persisted
          ? "Backup restored."
          : "Backup restored for this visit, but this device blocked permanent storage."
      );
    }

    function bind() {
      $("#btn-backup")?.addEventListener("click", downloadBackup);
      $("#btn-restore")?.addEventListener("click", () => $("#backup-file")?.click());
      $("#backup-file")?.addEventListener("change", async (event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        input.value = "";
        if (file) await restoreBackupFile(file);
      });
    }

    return { bind, setBackupStatus };
  }

  global.ChristoJournalBackup = { create };
})(typeof window !== "undefined" ? window : globalThis);
