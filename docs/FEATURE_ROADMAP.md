# ChristoDay feature roadmap

Researched 2026-10-14. Selected feature: download four weeks of reading dates as
an iCalendar file.

## Need and evidence

The current app provides daily reading, date navigation, catch-up, and private
journal history, but no way to put upcoming references into an existing calendar.
The need to plan outside the app is an inference from this gap, not a claim of
measured demand. A calendar file lets readers prepare their next four weeks
without connecting an account or sharing a journal.

Primary sources reviewed:

- [RFC 5545, iCalendar](https://datatracker.ietf.org/doc/html/rfc5545): sections
  3.1, 3.3.11 and 3.6.1 define CRLF, UTF-8-aware line folding, text escaping,
  all-day DATE events, and exclusive end dates. Section 3.8.4.7 defines event UIDs.
- [Google Calendar: import events](https://support.google.com/calendar/answer/37118?hl=en):
  supports ICS import on a computer through Settings → Import & export. Imported
  events do not stay synchronized with their original source. This supports a
  downloadable snapshot, with clear manual-import guidance.

## Selected scope

A collapsed calendar card after weekly catch-up downloads a `.ics` snapshot for
28 calendar days beginning at the displayed date. Before the plan starts, the
window begins at the existing 2026-06-15 epoch. Reading dates are resolved using
the unchanged Asia/Singapore schedule. Each weekday event is all-day, leaves
availability free, names the reference, and links back to that date in the
selected translation. Weekends remain rest. All-day dates do not shift with a
calendar's timezone. There are no supplied alarms; readers can set reminders in
their calendar.

The export accepts plan data, start date, and translation only. It contains no
journal notes, completion history, reflection answers, or Scripture text.
Downloading/importing does not create an account connection or synchronize future
changes. Repeated import behavior depends on the calendar; warn that importing
the same dates again may create duplicates.

## Acceptance criteria

- Epoch and ordinary four-week windows contain exactly the existing scheduled
  readings, including correct Jude rotation and year/month boundaries.
- Only weekday dates become events; pre-start exports start at the epoch.
- Dates use RFC 5545 DATE values with next-day exclusive ends; UIDs stay stable
  for the same reading date. Required calendar/event properties are present.
- Escaping and folding preserve commas, semicolons, backslashes, newlines, and
  multibyte characters without permitting extra properties or events.
- Real Chromium download is an `.ics` file containing 20 correct readings and
  usable production links, while private journal/completion and fetched passage
  text remain absent. Download failure reports a visible status.
- Calendar control works on weekday, weekend, and pre-start views, at phone width,
  and with the installed offline shell; new runtime is precached.
- All existing Node/browser/syntax gates pass, with export regressions added to CI.

## Next priorities

1. Optional user-selected reminder time, only after testing timed timezone events
   and calendar import behavior; do not imply notifications from this site.
2. Printable reference checklist for readers who plan on paper. Open it from
   the ⋯ menu in the reader header (version `2026.10.15.2`). Scope and defaults
   are below.
3. Longer-range preview with an explicit date range, preserving the deterministic
   schedule and compact phone reader.

## Printable checklist — scope and defaults

Implemented. The ⋯ menu in the reader header prints a reference-only
checklist for the same window as the `.ics` export. That menu also downloads
the calendar file. The window is 28 calendar days beginning at the displayed
date. When that date is before the plan starts, the window begins at the
2026-06-15 epoch. Weekends stay off the page. Each row is an empty checkbox,
the date, the weekday, and the book reference from the existing Asia/Singapore
schedule, including the Jude rotation. The checkbox is the CSS box only.

Defaults: four weeks, weekday readings only, and references only. The list has
no passage text, journal notes, reflection answers, or completion state. Print
styles show that list alone, in black on white, with no page background, and
keep each row together. The ⋯ menu is available on weekday, weekend,
and pre-start views, including phone width, and its script is in the offline shell.

## Limits

This iteration tests generated files and browser downloads. Import UI behavior in
Google, Apple, and Outlook calendars still needs manual product checks. Stable
UIDs do not guarantee that every calendar deduplicates repeated file imports.


## Delivery evidence

Implemented in version `2026.10.14.1`. All ten Node suites and full JavaScript
syntax checks passed. All 35 Chromium journeys passed, including phone-width
file download, rest/pre-start dates, failed download guidance, privacy exclusions,
and installed-worker offline export. Calendar import UI checks remain manual as
listed above.
