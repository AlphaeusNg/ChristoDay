# ChristoDay Continuous Improvement Progress

This file tracks current status, prioritized opportunities, verification, and
completed autonomous improvement cycles.

## Current state

- Deterministic weekday schedule with 39 passing schedule/data tests.
- Live Bible client with 4 passing network/passage tests and a 10-second timeout.
- Zero-build static site; journal and completion state remain device-local.

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | Run schedule and Bible tests in CI | Test / process | High compounding value: checks are currently local-only | Small / low | Node-only zero-install test commands | Next |
| 2 | Hydrate and validate saved journal/day state | Reliability | High: malformed nested localStorage can crash `ensureDay` or render paths | Small / low | Extract state normalization for Node tests | Backlog |
| 3 | Cache/deduplicate chapter requests | Performance / reliability | Medium: repeated navigation refetches identical chapters | Small / low | Bound cache by translation/book/chapter | Backlog |
| — | Bound live Bible fetch duration | Reliability / test | High: stalled requests left the UI loading indefinitely | Small / low | AbortController plus deterministic timer tests | Completed in Cycle 19 |

## Cycle log

### Cycle 19 — Bound and test live Bible fetches (2026-08-09)

**Why this won:** Schedule logic had strong coverage, but the public Bible API
boundary had only syntax checks. A request that never resolved left the passage
surface in “Loading Scripture…” indefinitely, defeating the documented graceful
fallback.

**Plan and success criteria**

1. Abort chapter requests after a fixed duration and return a stable timeout
   error that the existing fallback UI can display.
2. Always clear timers across success, HTTP failure, and abort paths.
3. Test request options, HTTP errors, timeout behavior, passage filtering,
   translation fallback, and escaped output without network access.

**Changes**

- Added a 10-second `AbortController` timeout to `fetchChapter` with `finally`
  cleanup.
- Exported the chapter client and timeout constant for focused verification.
- Added `tools/test-bible.mjs` with four network/passage cases and documented it
  in `AGENTS.md`.

**Verification evidence**

- `node tools/test-schedule.mjs`: 39 passed.
- `node tools/test-bible.mjs`: 4 cases passed.
- Syntax checks for all three JavaScript modules passed.
- `git diff --check`: passed.
- Timeout test aborts before fetch completion, returns `Bible fetch timed out`,
  and proves the scheduled timer is cleared.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 9/10 | Network stalls now reach the existing fallback deterministically |
| Test coverage / verifiability | 2/10 | 8/10 | Four isolated client/formatting paths supplement schedule tests |
| Maintainability | 6/10 | 8/10 | Timeout policy is named and chapter fetching is directly testable |
| Performance / resources | 5/10 | 8/10 | Abort and timer cleanup bound outstanding work |
| User experience | 3/10 | 8/10 | Loading cannot remain indefinite on a stalled API |

**Lesson / process improvement:** Network fallbacks are incomplete without a
time bound. Export the narrow client primitive and test it with fake fetch and
timers rather than relying on flaky external requests.

**Next opportunity:** Add zero-install GitHub Actions coverage for schedule,
Bible client, and syntax checks so regressions are caught on every push/PR.
