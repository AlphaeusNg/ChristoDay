# ChristoDay Continuous Improvement Progress

This file tracks current status, prioritized opportunities, verification, and
completed autonomous improvement cycles.

## Current state

- Deterministic weekday schedule with 39 passing schedule/data tests.
- Live Bible client with 7 passing network/cache/passage tests, a 10-second
  timeout, in-flight deduplication, and a 50-chapter memory cache.
- Persisted journal/completion state with 7 passing hydration/persistence cases
  and non-throwing save failure handling.
- GitHub Actions runs schedule, Bible client, and JavaScript syntax checks.
- Zero-build static site; journal and completion state remain device-local.

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | Validate Bible API response shapes before passage assembly | Correctness / robustness | Medium: `null` or malformed verse entries currently become generic fallback errors or empty text | Small / low | Normalize chapter payloads and test invalid entries | Next |
| — | Handle localStorage write failures without breaking input handlers | Reliability / UX | Medium: quota/privacy errors threw from journal/completion actions | Small / low | Boolean save contract plus status surface | Completed in Cycle 23 |
| — | Cache/deduplicate chapter requests | Performance / reliability | Medium: repeated navigation refetched identical chapters | Small / low | 50-entry cache plus in-flight map | Completed in Cycle 22 |
| — | Hydrate and validate saved journal/day state | Reliability | High: malformed nested localStorage crashed day initialization | Small / low | Six state boundary cases | Completed in Cycle 21 |
| — | Run schedule and Bible tests in CI | Test / process | High compounding value: checks were local-only | Small / low | Node 20 zero-install workflow | Completed in Cycle 20 |
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

### Cycle 20 — Run ChristoDay checks in CI (2026-08-09)

**Why this won:** The new Bible boundary suite and existing schedule tests were
fast and dependency-free but relied on local discipline. Automatic execution
makes both protections compound across every future change.

**Plan and success criteria**

1. Run schedule and Bible suites independently on pushes and pull requests.
2. Retain explicit syntax checks for every application module.
3. Reproduce the exact workflow commands locally before committing.

**Changes**

- Added `.github/workflows/ci.yml` using Node 20.
- Added separate schedule, Bible-client, and JavaScript-syntax steps for clear
  failure attribution.

**Verification evidence**

- Workflow-equivalent local run: 39 schedule assertions and 4 Bible cases
  passed; all JavaScript syntax checks passed.
- `git diff --check`: passed.
- No package installation or network access is required by the workflow.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 8/10 | Existing contracts now gate every change |
| Test coverage / verifiability | 3/10 | 9/10 | All automated checks run on push and PR |
| Maintainability | 6/10 | 8/10 | Failure domains have separate named steps |
| Performance / resources | 9/10 | 9/10 | Zero-install checks complete in well under a second locally |
| Developer experience | 5/10 | 9/10 | Regressions surface without manual command discovery |

**Lesson / process improvement:** When tests are zero-install and deterministic,
promote them to CI immediately; separate steps preserve actionable failure
signals without meaningful runtime cost.

**Next opportunity:** Extract and test saved-state hydration so malformed or
older `localStorage` values cannot crash journal, completion, or streak paths.

### Cycle 21 — Normalize persisted journal state (2026-08-09)

**Why this won:** `loadState` returned any successfully parsed JSON. A payload
such as `{"days":"broken"}` remained truthy, then strict-mode assignment in
`ensureDay` could crash the reading surface. Older or partially damaged local
state should preserve valid journal entries and safely default everything else.

**Plan and success criteria**

1. Centralize defaults, hydration, storage I/O, and day creation in a testable
   browser-global module.
2. Preserve valid journal/completion data while rejecting malformed containers,
   dates, field types, and translations.
3. Precache the new module, run it in CI, and bump the cache/site version.

**Changes**

- Added `js/state.js` and routed application state load/save/day creation
  through `ChristoState`.
- Added six hydration, corrupt-storage, day-creation, and save cases.
- Loaded and precached the module, extended CI/agent checks, and bumped version
  to `2026.08.09.1`.

**Verification evidence**

- Schedule: 39 passed; Bible client: 4 cases passed; state: 6 cases passed.
- Syntax checks passed for every `js/*.js` file and `sw.js`.
- `git diff --check`: passed.
- Valid completed journal data survives hydration; malformed `days` and corrupt
  JSON yield a writable `{ translation: "NIV", days: {} }` state.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 9/10 | Render paths receive stable nested state shapes |
| Test coverage / verifiability | 2/10 | 9/10 | Six persistence and migration paths run locally and in CI |
| Maintainability | 4/10 | 9/10 | State schema and storage boundary have one owner |
| Performance | 9/10 | 9/10 | Linear hydration over small per-day records |
| Privacy / safety | 7/10 | 9/10 | Only known local fields/types are retained and saved |

**Lesson / process improvement:** Parsed JSON is still untrusted input. Normalize
at the storage boundary and persist only the hydrated schema so repaired state
becomes durable.

**Next opportunity:** Add a bounded in-memory chapter cache with in-flight
request deduplication so repeated navigation and cross-range reads do not issue
duplicate public API requests.

### Cycle 22 — Cache and deduplicate chapter requests (2026-08-09)

**Why this won:** Revisiting a day or requesting overlapping ranges fetched the
same translation/book/chapter repeatedly. Concurrent callers also created
duplicate public API traffic, increasing latency and the chance of rate or
network failure.

**Plan and success criteria**

1. Share one promise for concurrent identical chapter requests.
2. Cache successful results with a strict 50-chapter FIFO bound.
3. Remove settled in-flight entries and never cache failures, so retry remains
   possible.

**Changes**

- Added separate resolved-data and in-flight maps keyed by
  translation/book/chapter.
- Added FIFO eviction at 50 chapters and an explicit cache reset hook.
- Extended the Bible suite with concurrent deduplication, resolved reuse,
  failure retry, and eviction coverage.

**Verification evidence**

- Bible client: 7 cases passed (up from 4); schedule: 39 passed; state: 6
  passed; all application/service-worker syntax checks passed.
- `git diff --check`: passed.
- Two concurrent calls issue one fetch; a rejected fetch is retried; chapter 1
  is refetched after 51 unique chapters prove bounded eviction.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 6/10 | 9/10 | Failures remain retryable and concurrent callers share outcomes |
| Test coverage / verifiability | 5/10 | 9/10 | Deduplication, reuse, retry, and eviction are deterministic tests |
| Maintainability | 6/10 | 8/10 | Resolved and in-flight states have distinct maps/lifecycles |
| Performance / resources | 4/10 | 9/10 | Repeat network calls are removed and memory is capped |
| User experience | 6/10 | 9/10 | Revisiting passages is immediate within the session |

**Lesson / process improvement:** Do not cache rejected promises. Separate
in-flight deduplication from resolved-value caching and bound the latter with an
observable eviction test.

**Next opportunity:** Make state persistence return a safe failure signal and
surface it without interrupting journal/completion interactions when
localStorage is unavailable or full.

### Cycle 23 — Survive localStorage write failures (2026-08-09)

**Why this won:** Browser privacy settings, disabled storage, and quota errors
can make `localStorage.setItem` throw. Those exceptions propagated through
journal input and completion handlers, interrupting interaction without telling
the user their private state was not durable.

**Plan and success criteria**

1. Convert persistence exceptions into a boolean result.
2. Keep in-memory interaction functioning and expose a non-blocking status
   warning when the device cannot save.
3. Hide the warning automatically after a later successful save.

**Changes**

- Wrapped hydrated-state serialization/storage in a true/false save contract.
- Added an accessible `role="status"` message beneath the journal.
- Routed app saves through the status surface and added success/failure tests.

**Verification evidence**

- State suite: 7 cases passed (up from 6); Bible: 7; schedule: 39.
- All application/service-worker syntax checks and `git diff --check` passed.
- A throwing storage adapter returns `false` without escaping; successful
  persistence returns `true` and retains completed journal data.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 9/10 | Storage denial no longer aborts handlers |
| Test coverage / verifiability | 5/10 | 9/10 | Both save outcomes are explicit tests |
| Maintainability | 7/10 | 8/10 | One boolean contract drives all save feedback |
| User experience | 3/10 | 9/10 | Users receive a clear, non-blocking durability warning |
| Privacy / safety | 6/10 | 9/10 | The UI no longer implies unsaved private text is durable |

**Lesson / process improvement:** Local-first does not mean localStorage is
infallible. Persistence APIs should return an observable result so UI handlers
can remain functional and honest about durability.

**Next opportunity:** Normalize Bible API payloads and reject malformed chapter
or verse records before filtering/ranking text, with stable fallback errors.
