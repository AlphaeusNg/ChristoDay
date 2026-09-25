/**
 * Decide what a Singapore date change may move.
 * An actively edited note that is not the new today stays put.
 * Completion follows the reading that remains on screen.
 */
(function (global) {
  "use strict";

  function decideTodayRollover(input) {
    const viewedYmd = input?.viewedYmd || "";
    const previousToday = input?.previousToday || "";
    const nextToday = input?.nextToday || "";
    const journalActive = input?.journalActive === true;
    if (!nextToday || nextToday === previousToday) {
      return {
        viewedYmd,
        moved: false,
        completionYmd: viewedYmd,
        showTodayLabel: viewedYmd === (nextToday || previousToday),
      };
    }
    const editingHistorical = journalActive && viewedYmd !== nextToday;
    const parkedOnOldToday = viewedYmd === previousToday;
    const nextView = editingHistorical || !parkedOnOldToday ? viewedYmd : nextToday;
    return {
      viewedYmd: nextView,
      moved: nextView !== viewedYmd,
      completionYmd: nextView,
      showTodayLabel: nextView === nextToday,
    };
  }

  global.ChristoToday = { decideTodayRollover };
})(typeof window !== "undefined" ? window : globalThis);
