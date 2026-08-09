# ChristoDay Continuous Improvement Progress

This file tracks current status, prioritized opportunities, verification, and
completed autonomous improvement cycles.

Last updated: 2026-08-10 (Cycle 86 across the projects workspace; ChristoDay Cycle 28)

## Current state

- Deterministic weekday schedule with 39 passing schedule/data tests.
- Live Bible client with 12 passing network/payload/cache/cancellation/passage
  tests, a 10-second timeout, consumer-aware in-flight deduplication, and a
  50-chapter memory cache.
- Persisted journal/completion state with 10 passing hydration/persistence cases
  and non-throwing save failure handling.
- GitHub Actions runs 18 workflow-policy assertions plus schedule, Bible, state,
  site/offline structure, and complete JavaScript syntax checks on Node 24 LTS
  with read-only permissions, stale-run cancellation, and a five-minute timeout.
- Zero-build static site; journal and completion state remain device-local.
- Deployment version: `2026.08.10.1`.

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | Add browser startup/day-navigation/translation smoke coverage | Verification | High: pure suites do not execute the complete DOM boot or cancellation integration | Medium / low | Reuse the test-only browser approach proven in the sibling static sites | Next |
| 2 | Validate fetched plan data before runtime rendering | Correctness | Medium: checked-in data passes schedule tests, but runtime fetch consumers trust its shape | Small-medium / low | Reuse schedule invariants and show safe visitor recovery | Backlog |
| — | Upgrade CI runtime, action versions, and job policy | Test / security / process | High: every check needed supported runtimes and bounded least privilege | Small / low | 18 executable workflow policies | Completed in Cycle 28 |
| — | Abort obsolete passage requests after navigation | Performance / reliability | Medium: sequence guards prevented stale rendering but unrelated requests continued until completion/timeout | Medium / medium | Ref-count shared chapter consumers and subscribe new UI work before aborting old | Completed in Cycle 27 |
| — | Validate saved date keys as real calendar dates | Correctness | Medium: regex-valid impossible dates remained in totals/state | Small / low | Leap-day and invalid calendar cases | Completed in Cycle 26 |
| — | Add structural shell/precache validation | Test / maintainability | Medium: HTML references and offline precache could drift silently | Small / low | 11 precache entries plus local refs | Completed in Cycle 25 |
| — | Validate Bible API response shapes before passage assembly | Correctness / robustness | Medium: malformed records caused incidental errors or empty text | Small / low | Normalized container and verse records | Completed in Cycle 24 |
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

### Cycle 24 — Validate Bible API payloads (2026-08-09)

**Why this won:** The client assumed every successful JSON response was an array
or object with `.verses`, then dereferenced every entry. `null`, malformed
containers, or null verse records produced incidental `TypeError`s; invalid
verse numbers could also enter filtering silently.

**Plan and success criteria**

1. Normalize supported array/object containers before caching.
2. Retain only positive integer verse numbers with string text.
3. Return stable errors for invalid chapter payloads and requested passages with
   no usable verses.

**Changes**

- Added and exported `normalizeChapterData`.
- Validated JSON before successful cache insertion and simplified passage
  assembly to consume normalized arrays only.
- Added invalid-container and mixed-entry payload cases.

**Verification evidence**

- Bible client: 9 cases passed (up from 7); schedule: 39; state: 7.
- All JavaScript/service-worker syntax checks and `git diff --check` passed.
- `null` containers now return `Bible API returned invalid chapter data`; a
  mixed payload retains only its valid `{ verse: 2, text: "Valid" }` record.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 9/10 | All downstream passage logic consumes a stable record shape |
| Test coverage / verifiability | 5/10 | 9/10 | Container and record corruption have direct cases |
| Maintainability | 5/10 | 8/10 | One normalizer owns third-party response assumptions |
| Performance | 8/10 | 8/10 | One linear filter/map before bounded caching |
| User experience | 5/10 | 8/10 | Fallback receives stable, meaningful failure messages |

**Lesson / process improvement:** Validate third-party JSON before caching it.
Caching only normalized successes prevents malformed data from becoming a
repeatable session-level failure.

**Next opportunity:** Add a structural test that every local HTML script/style
exists and that all required offline runtime files—including new state modules—
remain in the service-worker precache.

### Cycle 25 — Verify site and offline structure (2026-08-09)

**Why this won:** Adding `state.js` required coordinated edits to HTML load order
and the service-worker precache. Neither existing syntax tests nor browser code
would catch a missing path until deployment or an offline visit.

**Plan and success criteria**

1. Verify every local HTML `src`/`href` target exists.
2. Verify every precache entry exists and all runtime modules/data are included.
3. Lock the state-before-app load order and run the check in CI.

**Changes**

- Added `tools/test-site.mjs` for local references, 11 precache entries,
  required runtime assets, and script order.
- Added the structural command to `AGENTS.md` and GitHub Actions.

**Verification evidence**

- Site test reports all local references valid and 11 precache entries verified.
- Schedule: 39; Bible: 9; state: 7; all syntax checks passed.
- `git diff --check`: passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 6/10 | 9/10 | Missing/misordered runtime assets fail before deployment |
| Test coverage / verifiability | 4/10 | 9/10 | HTML and offline shell now have an executable contract |
| Maintainability | 5/10 | 9/10 | New modules require one obvious precache/test update |
| Performance | 9/10 | 9/10 | Structural check is filesystem-only and near-instant |
| Offline UX | 4/10 | 9/10 | Required reading shell/data omissions are CI failures |

**Lesson / process improvement:** PWA changes span runtime load order and offline
packaging. A small structural test should verify both whenever modules are added.

**Next opportunity:** Replace regex-only saved date validation with real UTC
calendar validation, preserving valid leap days while discarding impossible
month/day combinations.

### Cycle 26 — Validate saved calendar dates (2026-08-09)

**Why this won:** State hydration accepted any `YYYY-MM-DD` shape, including
`2026-02-30` and month 13. Those records could inflate completion totals and
remain permanently unreachable through the date input.

**Plan and success criteria**

1. Require strict format and a UTC parse/ISO round trip.
2. Preserve valid leap days while rejecting non-leap and impossible dates.
3. Apply the validator before any saved day enters hydrated state.

**Changes**

- Added/exported `validYmd` and used it in day-record hydration.
- Added valid leap-day, invalid leap-day, invalid month, and impossible saved-day
  coverage.

**Verification evidence**

- State: 10 cases passed (up from 7); Bible: 9; schedule: 39; site/offline
  structure and all syntax checks passed.
- `git diff --check`: passed.
- `2028-02-29` survives; `2027-02-29`, `2026-13-01`, and `2026-02-30` fail or
  are discarded.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 5/10 | 9/10 | Only reachable real dates contribute to state/totals |
| Test coverage / verifiability | 5/10 | 9/10 | Leap and impossible calendar boundaries are explicit |
| Maintainability | 7/10 | 8/10 | Date policy is one exported helper |
| Performance | 9/10 | 9/10 | One parse per small saved record |
| User experience | 6/10 | 8/10 | Ghost completion records are removed during hydration |

**Lesson / process improvement:** Format validation is not semantic validation.
For canonical date keys, round-trip through a timezone-fixed representation and
compare the exact original string.

**Next opportunity:** Coordinate UI-level cancellation with the shared Bible
request cache so navigating away can stop obsolete unique chapter requests
without disrupting consumers that still need the same in-flight request.

### Cycle 27 — Cancel obsolete passage consumers safely (2026-08-10)

**Why this won:** `renderSeq` prevented stale text from painting, but obsolete
unique chapter fetches still consumed network and timeout budget. Directly
aborting a deduplicated promise would also break a newer day or translation
request that needed the same in-flight chapter.

**Plan and success criteria**

1. Give every chapter caller an independent cancellation subscription.
2. Abort the underlying fetch only when its final consumer cancels.
3. Subscribe new UI work before cancelling old work so same-chapter navigation
   retains the shared request.
4. Keep cancellations out of the cache and make the same chapter immediately
   retryable after its last consumer leaves.

**Changes**

- Replaced the in-flight promise map with entries that track controller,
  pending state, promise, and consumer count.
- Added `AbortSignal` support to `fetchChapter` and `fetchPassage`; cancellation
  returns the stable `Bible fetch cancelled` error while the independent
  10-second timeout retains `Bible fetch timed out`.
- Remove an abandoned entry from the map before aborting its network request,
  preventing immediate retries from attaching to a doomed promise.
- Abort active requests when navigating to weekend/pre-plan states. For a new
  reading or translation, start the new passage subscription first and only
  then abort the previous controller.
- Extended Bible coverage from 9 to 12 cases and added a structural assertion
  that locks the subscribe-before-abort ordering.

**Verification evidence**

- Test-first: the new site contract failed because the app supplied no signal;
  the first cancellation case then waited for the old 10-second timeout and
  returned `Bible fetch timed out` instead of `Bible fetch cancelled`.
- Bible client: 12 cases passed, including one cancelled shared consumer with a
  surviving consumer, last-consumer underlying abort plus immediate retry, and
  cross-chapter cancellation before chapter two.
- Schedule: 39 passed; state: 10; site/offline structure: 11 precache entries.
- Syntax checks passed for all application/service-worker files;
  `data/segments.json` parsed; `git diff --check` passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 6/10 | 9/10 | Shared survivors are preserved and cancelled work cannot cache or poison retry |
| Test coverage / verifiability | 6/10 | 9/10 | Three deterministic ownership/cancellation cases plus UI ordering contract |
| Maintainability | 6/10 | 8/10 | Explicit consumer ownership replaces ambiguous shared-promise cancellation |
| Performance / resources | 5/10 | 9/10 | Obsolete unique work stops promptly instead of waiting up to 10 seconds |
| User experience | 7/10 | 9/10 | Rapid navigation spends bandwidth only on the current reading |

**Lesson / process improvement:** Cancellation ownership belongs at the shared
request boundary. Attach the replacement consumer before releasing the old one,
and delete a last-consumer entry synchronously before abort so an immediate
retry cannot inherit doomed work.

**Next opportunity:** Upgrade the CI workflow to supported Node/action versions,
explicit read-only permissions, a bounded timeout, and executable policy checks.
Workspace next: pivot after this ChristoDay cycle to keep improvement breadth
across the project hub.

### Cycle 28 — Modernize and enforce CI policy (2026-08-10)

**Why this won:** All nine unpublished reliability cycles depended on a workflow
that still used the deprecated Node 20 action runtime and tested on end-of-life
Node 20. It also had no explicit least-privilege permissions, timeout,
concurrency cancellation, or executable protection against policy regression.

**Plan and success criteria**

1. Lock supported action and Node majors with a test-first workflow contract.
2. Add read-only permissions, duplicate-run cancellation, and a bounded job.
3. Preserve every domain suite and expand syntax coverage to every module,
   tool, and the service worker.
4. Reproduce the exact workflow locally before publishing the accumulated
   verified series.

**Changes**

- Upgraded `actions/checkout` and `actions/setup-node` from v4 to v7.
- Moved project checks from Node 20 to Node 24 LTS.
- Added explicit `contents: read`, ref-scoped concurrency with stale-run
  cancellation, and a five-minute job timeout.
- Added `tools/test-workflow.mjs` with 18 trigger, permission, runtime, command,
  syntax, and deprecated-version assertions; CI now enforces that policy.
- Replaced the hand-maintained four-file syntax list with deterministic checks
  for every `js/*.js`, `tools/*.mjs`, and `sw.js` file.
- Updated contributor commands and bumped the site/offline cache version to
  `2026.08.10.1`.

**Verification evidence**

- Test-first: the new workflow suite failed on missing read-only permissions
  before implementation.
- Official action documentation uses checkout/setup-node v7; Node's release
  table identifies v20 as end-of-life and v24 as LTS.
- `node tools/test-workflow.mjs`: 18 CI policy assertions passed.
- Schedule: 39 passed; Bible: 12 network/payload/cache/cancellation cases;
  state: 10 hydration/persistence cases; site: 11 precache entries.
- Local runtime: Node `v24.14.1`.
- Recursive application/tool syntax and service-worker syntax passed.
- Segment/manifest JSON parsing and `git diff --check` passed.
- Retrying local HTTP preview served the ordered runtime modules, service-worker
  precache, and `2026.08.10.1` version successfully.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | Every existing contract runs on supported, bounded infrastructure |
| Test coverage / verifiability | 6/10 | 10/10 | The workflow now tests its own policy and every JS/tool file |
| Maintainability | 6/10 | 9/10 | Recursive syntax discovery replaces a drifting file list |
| Security / robustness | 5/10 | 9/10 | Read-only permissions and supported runtimes are enforced |
| Developer experience | 6/10 | 9/10 | Stale duplicate runs cancel and failures retain named attribution |

**Lesson / process improvement:** A CI workflow is production code for the
verification system. Test its permissions, runtimes, bounds, and command
coverage—not just whether its YAML currently parses. Prefer recursive discovery
when the repository's module layout is stable so new test files cannot escape
syntax checking.

**Next opportunity:** Add a browser startup/day-navigation/translation smoke
that executes the real DOM boot and cancellation integration. Workspace next:
rotate after publishing this infrastructure-focused ChristoDay cycle.
