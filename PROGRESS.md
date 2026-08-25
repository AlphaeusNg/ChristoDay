# ChristoDay Continuous Improvement Progress

This file tracks current status, prioritized opportunities, verification, and
completed autonomous improvement cycles.

Last updated: 2026-08-25 (ChristoDay Cycle 44)

## Current state

- Deterministic weekday schedule with 50 passing schedule/data/schema tests.
- Live Bible client with 12 passing network/payload/cache/cancellation/passage
  tests, a 10-second timeout, consumer-aware in-flight deduplication, and a
  50-chapter memory cache.
- Persisted journal/completion state with 13 passing hydration/persistence cases
  and non-throwing save failure handling. Passage size is a device-local
  preference beside translation.
- Service-worker runtime behavior has four deterministic execution scenarios
  plus a production-mounted installed-worker journey covering scope, cache
  ownership, event lifetime, network/cache failures, and offline reload.
- The controlled reading browser project covers startup, navigation,
  translation cancellation, live-passage failure fallback and recovery, denied
  journal/completion saves, in-memory continuity, honest durability status,
  recovery persistence, invalid fetched-plan fatal recovery, non-200 and
  non-JSON plan fetch fatal recovery, weekend next-step jumps, old unfinished-entry resume,
  schedule-valid completion totals, copy/share/listen/size, and
  `?d=` / `?tr=` deep-links.
- Reader chrome leads with today's date, streak, and passage: collapsed hero
  lede, `#about` in `<details>`, one-row gold-outline day toolbar, and weekend /
  pre-start Preview Monday + Last Friday actions with a Mon–Fri completion strip.
- Reading days expose Copy (Y), Listen (L), Share, and A−/A+ passage size.
  Copy writes the visible reference plus passage text; Listen reads it aloud
  and stops on a second press or day change; Share uses the Web Share API when
  present and otherwise copies date + reference + URL. `?d=YYYY-MM-DD` and
  optional `?tr=NIV|ESV|NKJV|WEB` open that day/translation; invalid dates fall
  back to today; date and translation changes `replaceState` so a copied URL
  matches the screen. Passage size persists on-device.
- Deployment version: `2026.08.25.5`.
- GitHub Actions runs 25 workflow-policy assertions plus schedule, Bible, state,
  site/offline structure, service-worker behavior, complete JavaScript syntax checks, and separate real
  Chromium reading and installed-service-worker journeys on Node 24 LTS with
  locked test dependencies, read-only permissions, stale-run cancellation, and
  a five-minute timeout.
- Zero-build static site; journal and completion state remain device-local.

## Opportunity backlog

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependencies | Status |
|---|---|---|---|---|---|---|
| — | Count only actual plan-reading completions | Correctness / reliability | Medium: hydrated weekend and pre-start flags inflated progress even though those screens cannot be completed | Small / low | One valid reading remains counted; impossible records remain preserved but excluded | Completed in Cycle 42 |
| — | Exercise an unparseable 200 plan body in a real browser | Verification / reliability | Low: 404 and schema-invalid JSON reached fatal recovery, but a proxy-style HTML body shared that surface without a dedicated journey | Small / low | Controlled non-JSON 200, inert UI, safe fatal copy, and parse diagnostic | Completed in Cycle 41 |
| — | Remove the 80-weekday horizon from Continue incomplete | Correctness / performance | Medium: older unfinished journals became undiscoverable as the plan aged | Small / low | Saved-entry selection and a >80-weekday Chromium resume | Completed in Cycle 40 |
| — | Show weekday progress, yesterday's journal line, and Continue incomplete | UX / continuity | Medium | Small / low | Runtime UI, schedule occurrence field, and saved-state boundary | Completed in Cycle 39 |
| — | Copy the visible passage, share today's reading, and deep-link date/translation | UX | High: visitors could not copy, share, or reopen a specific day | Small / low | Copy + Y, Web Share / clipboard fallback, `?d=` / `?tr=` boot and replaceState | Completed in Cycle 38 |
| — | Lead phones with today's reading and give weekend/pre-start a next step | UX | High: hero + about + two-row toolbar buried Scripture; weekend was a tombstone | Medium / low | Compact date/streak line, details about, gold-outline toolbar, Preview Monday / Last Friday, Mon–Fri strip | Completed in Cycle 37 |
| — | Exercise HTTP plan-fetch failure in a real browser | Verification / reliability | Low-medium: invalid JSON now reaches fatal recovery, but a non-200 plan response shares that surface without a dedicated journey | Small / low | Controlled 404 plan route, unbound UI, HTTP-status diagnostic, and existing user-safe fatal copy | Completed in Cycle 36 |
| — | Exercise invalid reading-plan recovery in a real browser | Verification / reliability | Medium | Small-medium / low | Impossible start date payload, alert copy, unbound UI, and expected diagnostic are controlled in Chromium | Completed in Cycle 35 |
| — | Exercise live-passage failure fallback in a real browser | Verification / reliability | Medium | Small-medium / low | Reference, explanation, journal/completion usability, and translation recovery are controlled in Chromium | Completed in Cycle 34 |
| — | Exercise journal save-denial status in a real browser | Verification / UX | Medium | Small-medium / low | Denial, navigation continuity, guidance, and recovery persistence are controlled in Chromium | Completed in Cycle 33 |
| — | Restrict runtime caching to the ChristoDay service-worker scope and bind cache writes to the fetch event lifetime | Isolation / reliability | Medium | Small-medium / low | Production-mounted browser and deterministic worker fixture cover scope, cache ownership, lifecycle, and failures | Completed in Cycle 32 |
| — | Add installed-service-worker offline reload smoke coverage | Verification / reliability | Medium-high: structural checks proved precache membership but not a controlled offline reload | Medium / low | Worker-enabled Chromium now verifies cache ownership plus offline document, CSS, module, and plan responses | Completed in Cycle 31 |
| — | Add browser startup/day-navigation/translation smoke coverage | Verification | High: pure suites did not execute the complete DOM boot or cancellation integration | Medium / low | Locked offline Playwright fixture and 24 CI policy contracts | Completed in Cycle 30 |
| — | Validate fetched plan data before runtime rendering | Correctness | Medium: checked-in data passed schedule tests, but runtime fetch consumers trusted its shape | Small-medium / low | 10 schema/boundary contracts plus fatal recovery integration | Completed in Cycle 29 |
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

### Cycle 44 — Resize today's passage (2026-08-25)

**Why this won:** Listen helps commuters, but readers still had one fixed type
size. Phone Scripture was cramped; desktop was small for tired eyes.

**Changes**

- A− / A+ (and − / +) cycle small, default, and large passage text.
- Size persists with journal state. Unknown values fall back to default.
- Version `2026.08.25.5`.

### Cycle 43 — Read today's passage aloud (2026-08-25)

**Why this won:** Copy and Share already get the text off the screen. Commuters
and listeners still had to stare at the phone. VerseKeep already reads verses;
ChristoDay's visible passage did not.

**Changes**

- Listen (L) speaks the visible reference plus passage via Web Speech.
- A second press or day change stops reading. Missing speech APIs stay honest.
- Version `2026.08.25.4`.

### Cycle 42 — Count only actual plan-reading completions (2026-08-25)

**Why this won:** Persisted state correctly retained every real calendar date,
but the “days completed” total counted any entry whose `completed` flag was
true. A stale or corrupt weekend or pre-plan record therefore inflated the
statistic even though those views never expose the completion control. The
fetched-plan and Bible render audit found their output-encoding boundaries
already sound, making this the highest-impact reproduced gap.

**Plan and success criteria**

1. Seed one valid plan reading, one weekend, and one pre-start completion.
2. Require the displayed total to count only the valid reading.
3. Preserve all saved entries rather than deleting potentially useful journal
   text during recovery.
4. Run every deterministic, browser, offline, syntax, audit, and hosted gate.

**Changes**

- Derive the completion total only from valid dates that resolve against the
  loaded plan as `kind === "reading"`.
- Added a Chromium journey that proves one valid completion remains counted,
  two impossible completions are excluded, and all three stored entries remain
  intact.
- Bumped the site and offline-cache stamp to `2026.08.25.3`.

**Verification evidence**

- Test-first: the old browser rendered `3` completed days instead of `1` for
  the controlled saved state.
- Schedule/data/schema 50, Bible 12, state 10, service-worker behavior, site
  structure, workflow policy 25, recursive syntax, diff checks, and the
  zero-vulnerability npm audit passed.
- `CI=1 npm run test:browser`: 14/14 reading and installed-worker journeys
  passed, up from 13.
- Hosted CI run `32774432266` passed every Node 24 and Chromium gate in 1m6s;
  Pages run `32774430527` deployed successfully, and the live site serves
  version `2026.08.25.3`.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 10/10 | The total now follows the plan domain rather than any saved boolean |
| Test coverage / verifiability | 5/10 | 10/10 | Valid, weekend, and pre-start records execute through hydration and UI |
| Maintainability | 7/10 | 9/10 | One derived counter delegates date meaning to the schedule engine |
| Performance / resources | 9/10 | 9/10 | A bounded device-local map gains one schedule check per completed entry |
| Security / robustness | 8/10 | 9/10 | Corrupt or legacy flags cannot distort the public progress total |
| User experience | 5/10 | 10/10 | “Days completed” now means days the app actually allows completing |

**Lesson / process improvement:** Safe hydration and truthful aggregation are
separate boundaries. Preserve recoverable user content, but derive statistics
through the product's domain rules instead of trusting a persisted flag alone.

**Next opportunity:** No higher-impact unblocked ChristoDay item is currently
recorded. Rotate repositories and return when new runtime evidence appears.

### Cycle 41 — Browser-gate non-JSON plan recovery (2026-08-25)

**Why this won:** A successful HTTP status does not guarantee that a static JSON
asset contains JSON. A proxy, captive portal, or host error page could return
HTML with status 200. The app claimed a safe fatal path, but the real-browser
suite covered only a 404 and structurally invalid JSON.

**Plan and success criteria**

1. Fulfill `segments.json` with status 200, `text/html`, and an HTML body in the
   controlled browser fixture.
2. Verify the alert copy, inert reading controls, empty plan state, and a
   developer-visible parse diagnostic.
3. Keep runtime code unchanged if the existing boundary already behaves safely,
   then run every deterministic, browser, offline, syntax, and audit gate.

**Changes**

- Added a Chromium journey for a 200 non-JSON plan response, including the
  visible fatal recovery, unbound date change, empty internal plan, and retained
  JSON parse diagnostic.
- Bumped the site/offline cache version to `2026.08.25.2`; production runtime
  behavior is otherwise unchanged.

**Verification evidence**

- The new targeted journey passed on its first run, confirming the existing
  catch boundary already handles this response safely.
- Schedule/data/schema 50, Bible 12, state 10, service-worker behavior, site
  structure, workflow policy 25, recursive syntax, and diff checks passed.
- `CI=1 npm run test:browser`: 13/13 reading and installed-worker journeys
  passed, up from 12. `npm audit --audit-level=high` found zero vulnerabilities.
- Hosted CI run `32763287352` passed every Node 24 and Chromium gate; Pages run
  `32763286195` deployed successfully, and the live site serves `2026.08.25.2`.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 8/10 | 9/10 | Existing safe recovery is now protected against regression |
| Test coverage / verifiability | 5/10 | 9/10 | A real browser executes the status-200 parse-failure boundary |
| Maintainability | 8/10 | 8/10 | The test follows the established controlled-route pattern |
| Performance / resources | 10/10 | 10/10 | Runtime code is unchanged |
| Security / robustness | 8/10 | 9/10 | Unexpected intermediary HTML cannot silently initialize partial state |
| User experience | 9/10 | 9/10 | The existing concise recovery alert is now enforced |

**Lesson / process improvement:** Exercise content type and payload parsing
separately from HTTP status. A 200 response is transport success, not an
application-level validity guarantee.

**Next opportunity:** Rotate to Car-Type-Classification-Service, load its
current state, and select the highest-value reliability improvement that does
not depend on the blocked model re-export boundary.

### Cycle 40 — Resume unfinished entries without an age cutoff (2026-08-25)

**Why this won:** The new Continue incomplete action walked back at most 80
weekdays. As the ongoing plan aged, a legitimate older unfinished journal
silently disappeared even though it remained saved on the device.

**Plan and success criteria**

1. Reproduce the cutoff in Chromium with an unfinished June 2026 entry viewed
   from January 2027.
2. Select the newest eligible saved entry before the viewed day without a
   calendar-walk horizon.
3. Verify the CTA label, navigation, and restored journal through the real UI,
   then run every deterministic, browser, offline, syntax, and audit gate.

**Changes**

- Replaced the 80-iteration weekday walk with one pass over hydrated saved-day
  entries, filtered to the plan range, past weekdays, nonempty journals, and
  incomplete status; the newest ISO date wins.
- Added a real Chromium journey with an unfinished entry more than 80 weekdays
  old and a later completed decoy.
- Bumped the site/offline cache version to `2026.08.25.1`.

**Verification evidence**

- Test-first: the old implementation left `#btn-continue-incomplete` hidden in
  the January 2027 fixture.
- Schedule/data/schema 50, Bible 12, state 10, service-worker 4 scenarios, site
  structure, workflow policy 25, recursive syntax, and diff checks passed.
- `CI=1 npm run test:browser`: 12/12 reading and installed-worker journeys passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- Hosted CI run `32760753055` passed every Node 24 and Chromium gate; Pages run
  `32760751784` deployed successfully, and the live site served version
  `2026.08.25.1`.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 10/10 | A saved unfinished entry no longer expires from the resume search |
| Test coverage / verifiability | 4/10 | 10/10 | The long-horizon CTA, navigation, and journal restoration are browser-locked |
| Maintainability | 6/10 | 9/10 | Selection operates directly on the state being queried, without a magic time bound |
| Performance / resources | 6/10 | 9/10 | Work is proportional to saved entries rather than empty calendar days |
| Security / robustness | 9/10 | 9/10 | Hydrated local-only state and text-only journal rendering remain unchanged |
| User experience | 5/10 | 9/10 | Long-running users retain a dependable path back to unfinished reflection |

**Lesson / process improvement:** Search the finite domain that owns the data.
Walking calendar dates introduced both an arbitrary correctness horizon and
work unrelated to the number of saved entries.

**Next opportunity:** Browser-gate a 200 non-JSON plan response through the
existing safe fatal recovery surface, then rotate repositories.

### Cycle 39 — Show weekday progress and resume the last incomplete entry (2026-08-18)

- Added weekday occurrence context, the previous weekday's journal line, and a
  Continue incomplete CTA for saved unfinished reflections.
- Shipped version `2026.08.18.6` in commit `b4094b1`; Cycle 40 subsequently
  removed its initial 80-weekday search horizon.

### Cycle 38 — Copy, share, and deep-link today's reading (2026-08-18)

**Why this won:** The weekday product is meant to be opened, read, and passed
along. Visitors could finish a passage and still had no way to copy the visible
text, share today's reading, or reopen a specific date/translation from a URL.

**Plan and success criteria**

1. Add a Copy control that writes the visible reference plus passage text and
   announces through a small `role="status"` (Y is optional).
2. Add Share that prefers the Web Share API and otherwise copies
   `date · ref · URL`.
3. Honor `?d=YYYY-MM-DD` and optional `?tr=NIV|ESV|NKJV|WEB` on boot. Invalid
   dates fall back to today. `replaceState` when the user changes date or
   translation so a copied URL matches the screen.
4. Keep `#date-pick`, `#translation`, `#reading-panel`, `#fatal`, and
   weekend/preview IDs. Journal stays `localStorage` only.

**Changes**

- Added `#btn-copy`, `#btn-share`, and `#action-status` on the reading card.
- Boot reads `d` / `tr`; invalid dates fall back to Singapore today and invalid
  translations keep the saved/default Bible. Date, next/prev/today, weekend
  jumps, and the translation select call `history.replaceState`.
- Share writes the same deep-link into the address bar, then shares or copies
  one line. Journal text is never copied or shared.
- Bumped the site/offline cache version to `2026.08.18.5`.

**Verification evidence**

- Schedule, Bible, state, site, service-worker, and workflow suites plus
  recursive syntax checks.
- `npm run test:browser` including deep-link boot, invalid-date fallback,
  URL sync after date/translation changes, clipboard copy + Y, and Web Share
  when `navigator.share` is present.
- Existing IDs and local-only journal behavior are unchanged.

**Lesson / process improvement:** A shareable reading needs the address bar and
the share payload to describe the same day. Update the URL on user changes, and
canonicalize a bad incoming `d` so a copied link cannot keep an impossible date.

**Next opportunity:** Rotate among VerseKeep, KoboForge, the portfolio, and
AIly. Skip Car-Type-Classification-Service. On the next ChristoDay rotation,
browser-gate a network-aborted or unparseable plan body if that path still
lacks a dedicated journey.

### Cycle 37 — Lead with today's reading (2026-08-18)

**Why this won:** The weekday product is a 5–10 minute gospel reading. On a
phone the long hero lede, two stat cards, a wrapping toolbar, and a full About
card pushed Scripture below the fold. Weekend and pre-start states were
tombstones — rest copy with no way to preview Monday or revisit Friday.

**Plan and success criteria**

1. Collapse the hero to one short line and fold `#about` into `<details>`.
2. On `max-width: 560px`, show a compact date + streak line, then the reading
   (or weekend/before) panel without a lonely third toolbar row.
3. Give weekend and pre-start **Preview Monday** and **Last Friday** actions
   that reuse `renderDay` / the date picker, plus a Mon–Fri completion strip
   from `state.days[ymd].completed`.
4. Keep `#fatal`, `#date-pick`, and the passage surface IDs intact.

**Changes**

- Shortened the hero lede; wrapped About in `<details id="about">` and open it
  when the hash is `#about`.
- Grouped date, stats, and toolbar in `.reader-head` so phones can grid a
  date + streak line above one nowrap gold-outline toolbar (`← Today →`, native
  date, translation select; visible "Translation" label removed).
- Weekend and pre-start cards now offer Preview Monday / Last Friday. The
  weekend card also renders a Mon–Fri strip (gold `.badge.btn-primary` when
  completed, dim empty) that jumps to that weekday.
- Bumped the site/offline cache version to `2026.08.18.3`.

**Verification evidence**

- Schedule, Bible, state, site, service-worker, and workflow suites plus
  recursive syntax checks.
- `npm run test:browser` including weekend next-step jumps from Saturday to
  last Friday and next Monday, and pre-start Preview Monday to plan epoch.
- Desktop hero and stat cards stay in the existing navy / Playfair / gold
  language; journal remains `localStorage` only.

**Lesson / process improvement:** Rest days still need a next step. A
tombstone that only explains the calendar trains people to leave; two jumps
that reuse the existing day renderer keep Sabbath rest without stranding the
reader.

**Next opportunity:** Rotate among VerseKeep, KoboForge, the portfolio, and
AIly. Skip Car-Type-Classification-Service. On the next ChristoDay rotation,
browser-gate a network-aborted or unparseable plan body if that path still
lacks a dedicated journey.

### Cycle 36 — Browser-gate non-200 plan fetch recovery (2026-08-18)

**Why this won:** Workspace cycle 160 returned here after the documented
rotation. Invalid JSON already reached the user-safe fatal surface, but a
missing or failing `segments.json` response used the same `!res.ok` branch
without a Chromium contract. A regression could bind a reading from a later
retry or leak an HTTP status into the visitor-facing copy.

**Plan and success criteria**

1. Serve a controlled 404 on the real `segments.json` route.
2. Prove the alert, exact recovery copy, unbound date control, and absent plan
   handle.
3. Keep the suite's unexpected-error gate intact by accepting only the known
   plan-load and HTTP-404 diagnostics.

**Changes**

- Added a reading-browser journey that fulfills `data/segments.json` with HTTP
  404 and a non-JSON body.
- Verified `#fatal` is a visible alert with the stable user-safe message, the
  version stamp and passage surface stay at their empty defaults, and changing
  the date does not start a reading.
- Required the matching `plan load failed` / `HTTP 404` diagnostic and allowed
  Chromium's 404 resource message so other errors still fail the suite.
- Documented the expanded browser scope and bumped the site/offline cache
  version to `2026.08.18.2`; runtime already threw on non-200 and did not need
  alteration.

**Verification evidence**

- The application assertions passed on the first focused run, converting the
  existing non-200 fail-closed claim into an enforceable Chromium contract.
- Schedule 49/49, Bible 12/12, state 10/10, site, service-worker, and
  workflow 25/25 passed.
- `npm run test:browser`: 6/6 reading and offline journeys passed.
- Recursive syntax, tracked JSON, and `git diff --check` passed.
- Correctness/reliability: 9/10 → 9/10 (behavior was already correct;
  regression risk is materially lower).
- Verifiability: 5/10 → 10/10 (404 copy, unbound UI, and HTTP-status
  diagnostic are now exercised at the DOM boundary).
- Maintainability: 8/10 → 9/10 (the documented startup recovery now has one
  deterministic owner for both invalid JSON and non-200).
- Performance/resources: 10/10 → 10/10 (test-only runtime behavior).
- Security/privacy: 9/10 → 9/10 (HTTP failure cannot become runtime plan
  state).
- User experience: 9/10 → 9/10 (the existing non-technical recovery is now
  protected for missing plan files).

**Lesson / process improvement:** Invalid JSON and non-200 look identical to
visitors, but they take different fetch branches. Gate the HTTP status path
with a fulfilled error response and allow only that status in the console
filter; do not weaken the suite-wide error invariant to cover it.

**Next opportunity:** Rotate among VerseKeep, KoboForge, the portfolio, and
AIly. Skip Car-Type-Classification-Service. On the next ChristoDay rotation,
browser-gate a network-aborted or unparseable plan body if that path still
lacks a dedicated journey.

### Cycle 35 — Browser-gate invalid reading-plan recovery (2026-08-18)

**Why this won:** Workspace rotation returned here after AlpArcade. Schema
units and a source-order contract already rejected malformed plans, but no
DOM journey proved startup stayed on the user-safe fatal surface instead of
partially binding the reading UI.

**Plan and success criteria**

1. Serve one structurally invalid but parseable plan payload on the real
   `segments.json` route.
2. Prove the alert, exact recovery copy, unbound date control, and absent plan
   handle.
3. Keep the suite's unexpected-error gate intact by accepting only the known
   plan-load diagnostic.

**Changes**

- Added a reading-browser journey that fulfills `data/segments.json` with an
  impossible start date and incomplete catalog.
- Verified `#fatal` is a visible alert with the stable user-safe message, the
  version stamp and passage surface stay at their empty defaults, and changing
  the date does not start a reading.
- Allowed only the matching `plan load failed` / `Invalid reading plan`
  console diagnostic so other errors still fail the suite.
- Documented the expanded browser scope and bumped the site/offline cache
  version to `2026.08.18.1`; runtime behavior did not need alteration.

**Verification evidence**

- The application assertions passed on the first focused run, converting the
  existing fatal-recovery claim into an enforceable Chromium contract.
- Schedule 49/49, Bible 12/12, state 10/10, site, service-worker, and
  workflow 25/25 passed.
- `npm run test:browser`: 5/5 reading and offline journeys passed.
- Recursive syntax, tracked JSON, and `git diff --check` passed.
- Correctness/reliability: 9/10 → 9/10 (behavior was already correct;
  regression risk is materially lower).
- Verifiability: 5/10 → 10/10 (fatal copy, unbound UI, and expected diagnostic
  are now exercised at the DOM boundary).
- Maintainability: 8/10 → 9/10 (the documented startup recovery now has one
  deterministic integration owner).
- Performance/resources: 10/10 → 10/10 (test-only runtime behavior).
- Security/privacy: 9/10 → 9/10 (invalid plan data cannot become runtime state).
- User experience: 9/10 → 9/10 (the existing non-technical recovery is now
  protected).

**Lesson / process improvement:** A source-order unit contract proves the
validator is called, not that visitors see the recovery surface. When the
application intentionally logs a diagnostic, allow that exact message in the
test that provoked it instead of disabling the suite-wide console gate.

**Next opportunity:** Rotate to VerseKeep, the oldest remaining non-profile
backlog. On the next ChristoDay rotation, browser-gate a non-200 plan fetch if
that path still lacks a dedicated journey.

### Cycle 34 — Browser-gate live-passage failure fallback (2026-08-11)

**Why this won:** Bible unit tests covered HTTP, payload, and timeout failures,
but the complete DOM path had never proved that a failed public API response
left a useful reading surface. A regression could hide the reference, disable
journaling/completion, or prevent translation recovery while all focused client
tests remained green.

**Plan and success criteria**

1. Return one controlled invalid Matthew payload without using the external API.
2. Prove the reading reference, explanatory fallback, and unavailable
   translation label are honest and visible.
3. Prove journal/completion controls still work and selecting another
   translation restores live text, with no page or console errors.

**Changes**

- Added a real Chromium journey that forces the NIV Matthew chapter boundary to
  return a structurally invalid payload.
- Verified the exact Matthew reference, visible failure explanation,
  reference-only body, and unavailable live-translation label.
- Exercised journal entry and completion during the fallback, then changed to
  ESV and proved the status cleared and live text returned.
- Documented the expanded browser scope and bumped the site/offline cache
  version to `2026.08.11.6`; runtime behavior did not need alteration.

**Verification evidence**

- The application assertions passed on the first run, confirming the existing
  fallback behavior. The initial HTTP-503 fixture correctly produced Chromium
  console errors and failed the suite's strict error gate; replacing it with an
  invalid successful payload exercised the same application boundary without
  weakening that invariant.
- The focused fallback journey passed after the fixture correction.
- The complete schedule 49/49, Bible 12/12, state 10/10, site, service-worker,
  workflow 25/25, and browser 4/4 suites passed after the final state edits.
- Correctness/reliability: 9/10 → 9/10 (behavior was already correct; regression
  risk is materially lower).
- Verifiability: 5/10 → 10/10 (fallback content, continued controls, and live
  recovery are now exercised at the DOM boundary).
- Maintainability: 8/10 → 9/10 (the documented product promise now has one
  deterministic integration owner).
- Performance/resources: 10/10 → 10/10 (test-only runtime behavior).
- Security/privacy: 9/10 → 9/10 (controlled responses and local-only journal
  behavior are unchanged).
- User experience: 9/10 → 9/10 (the existing resilient UX is now protected).

**Lesson / process improvement:** Expected failure fixtures should not force a
suite to ignore browser errors broadly. Exercise the application's rejection
boundary with a controlled bad payload when HTTP devtools noise would otherwise
weaken a strict console gate. Verify fallback usefulness, not just error copy,
by continuing through the core controls and recovery path.

**Next opportunity:** Rotate to AIly for the next workspace cycle. On the next
ChristoDay rotation, browser-gate invalid fetched-plan startup and the intended
fatal recovery surface.

### Cycle 33 — Browser-gate denied journal persistence (2026-08-11)

**Why this won:** The state unit already proved that storage exceptions return
`false`, but no browser contract exercised the complete input/status/navigation
path. A regression could erase typed journal text, misreport durability, or
fail to flush the current in-memory day after storage recovered while every
pure test remained green.

**Plan and success criteria**

1. Deny only writes to `christoday.v1` in real Chromium without disturbing
   page startup or the controlled Bible API.
2. Prove journal text and completion remain visible through a day-navigation
   round trip while the accessible status explains the durability risk.
3. Re-enable writes and prove the complete in-memory entry becomes durable and
   the warning clears.

**Changes**

- Added a reading-browser journey with a selectively failing Storage adapter.
- Verified the journal input, completion button, completed-day count, warning
  copy, absent device record, and navigation continuity during denial.
- Verified a later permitted input persists both the recovered journal text and
  the earlier completion state, then hides the warning.
- Documented the expanded browser scope and bumped the deployment version to
  `2026.08.11.5`; runtime behavior did not need alteration.

**Verification evidence**

- The new contract passed on its first focused execution, confirming the
  existing runtime behavior and converting an unverified claim into a gate.
- The strengthened journal-plus-completion journey passed 5/5 repeated runs.
- The complete schedule, Bible, state, site, service-worker, workflow, browser,
  dependency-audit, syntax, JSON, diff, hosted CI, Pages, and live-version
  results are recorded in the Cycle 138 completion summary.
- Correctness/reliability: 9/10 → 9/10 (behavior was already correct; regression
  risk is materially lower).
- Verifiability: 5/10 → 10/10 (the full denial, continuity, and recovery path is
  now exercised in a browser).
- Maintainability: 8/10 → 9/10 (the persistence contract is documented at its
  real DOM boundary).
- Performance/resources: 10/10 → 10/10 (test-only change; runtime unchanged).
- Security/privacy: 9/10 → 9/10 (local-only behavior unchanged and now proven).
- User experience: 9/10 → 9/10 (existing honest behavior is now protected).

**Lesson / process improvement:** A green-on-first-run test is valid improvement
when closing a known verification gap: it does not prove a new fix, but it makes
an important behavior enforceable. Recovery tests should verify the entire
in-memory record is flushed, including fields changed by a different control.

**Next opportunity:** Rotate to AIly for the next workspace cycle. On the next
ChristoDay rotation, browser-gate the reference-only passage fallback when the
live Bible request fails.

### Cycle 32 — Isolate runtime caching and own fetch lifetimes (2026-08-11)

**Why this won:** ChristoDay shares the `alphaeusng.github.io` origin with other
projects, but its fetch handler cached every same-origin GET and used global
`caches.match()`. It could therefore store out-of-scope resources or serve a
ChristoDay URL from another project's older cache. Runtime writes also ran as
detached promises that the browser could terminate after the response settled.

**Plan and success criteria**

1. Reproduce the production `/ChristoDay/` scope in Chromium.
2. Prove out-of-scope resources never enter the owned cache and foreign caches
   never answer ChristoDay requests.
3. Bind network refresh/cache writes to `event.waitUntil()` without letting a
   cache failure discard a usable network response.

**Changes**

- Derived the runtime boundary from `self.registration.scope` and bypassed all
  cross-origin or same-origin out-of-scope requests, keeping the Bible API and
  shared-origin siblings network-only.
- Replaced global `caches.match()` with lookup in the current versioned
  ChristoDay cache only.
- Shared one background network/update promise between cache-first response
  logic and `event.waitUntil()`, and isolated `cache.put()` failures from valid
  network delivery.
- Mounted Playwright from the projects parent at `/ChristoDay/`, seeded a
  conflicting foreign cache entry, fetched the same-origin root, and retained
  the existing controlled offline reading assertions under the true prefix.
- Added `tools/test-service-worker.mjs` with four executable scope, ownership,
  lifetime, offline fallback, and cache-write failure scenarios; wired it into
  local commands and CI, raising workflow policy coverage from 24 to 25.
- Bumped the site/cache version to `2026.08.11.4`.

**Verification evidence**

- Test-first source policy failed on absent installed-scope derivation; the
  production-mounted browser then proved the origin root entered ChristoDay's
  cache before the fix.
- Self-review red evidence: a rejected `cache.put()` caused the first worker
  implementation to return `undefined` instead of the valid network response;
  the execution fixture caught it and passed after failure isolation.
- Schedule 49/49, Bible 12/12, state 10/10, site/offline structure, service
  worker execution, and workflow policy 25/25 pass.
- Both real Chromium journeys pass: live reading/navigation and installed
  worker cache isolation/offline reload. Recursive syntax, tracked JSON,
  dependency audit, and `git diff --check` pass.
- Correctness/reliability: 5/10 → 10/10 (only owned scope/cache data can answer,
  and cache failure no longer breaks network delivery).
- Verifiability: 5/10 → 10/10 (source policy, VM execution, and installed worker
  each cover a different failure boundary).
- Maintainability: 7/10 → 9/10 (scope and cache ownership have one explicit
  runtime policy with an executable CI gate).
- Performance/resources: 6/10 → 9/10 (out-of-scope traffic bypasses the worker;
  in-scope refreshes have a bounded event lifetime).
- Security/isolation: 4/10 → 10/10 (shared-origin sibling resources and caches
  cannot contaminate ChristoDay responses).

**Lesson / process improvement:** A cache prefix protects deletion only. Full
ownership also requires scope-constrained writes and current-cache reads.
Whenever `waitUntil()` is added, simulate cache rejection separately so
lifecycle correctness does not accidentally turn optional caching into a hard
response dependency.

**Next opportunity:** Exercise journal persistence denial through the real DOM
so visible text continuity and honest durability status are browser-gated.

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

### Cycle 29 — Validate fetched reading-plan data (2026-08-11)

**Why this won:** A successful JSON parse was assigned directly to runtime
state. A malformed service-worker cache entry or deployed payload could then
throw inside schedule/render paths when weekday mappings, books, segment arrays,
rotations, or reflection prompts were absent. The visitor saw an incidental
failure instead of the existing safe fatal state.

**Plan and success criteria**

1. Validate the calendar epoch, timezone, five weekday mappings, mapped book
   metadata, segment/rotation references, and reflection prompts.
2. Reject invalid data before assigning it to the application plan.
3. Keep the detailed cause observable in the console while showing visitors the
   stable non-technical recovery message.

**Changes**

- Added `ChristoSchedule.validatePlan`, including semantic date/Monday checks,
  the fixed Singapore timezone, referenced book structure, ordered passage
  ranges, exactly four rotation entries, and non-empty reflection prompts.
- Routed fetched JSON through validation before `plan` assignment and logged the
  diagnostic while preserving the existing fatal UI.
- Added ten schedule/schema assertions plus a structural contract locking
  validation ahead of runtime assignment.
- Bumped the site/service-worker cache version to `2026.08.11.1`.

**Verification evidence**

- Test-first: the schedule suite failed because validation was not exported;
  the site suite independently failed because the app assigned unvalidated data.
- Schedule/data/schema suite: 49 passed (up from 39), covering the checked-in
  payload plus null, impossible date, missing mapping/book, empty segments,
  malformed references, incomplete rotation, and missing prompts.
- Bible client: 12; persisted state: 10; workflow policy: 18; site/offline
  structure: 11 precache entries.
- Recursive application/tool/service-worker syntax, segment/manifest JSON
  parsing, local served-page probes, and `git diff --check` passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 5/10 | 9/10 | Only a complete, internally consistent plan reaches schedule/render consumers |
| Test coverage / verifiability | 6/10 | 9/10 | Ten schema cases and assignment-order integration run in CI |
| Maintainability | 6/10 | 9/10 | Schedule data invariants now have one named owner |
| Performance | 9/10 | 9/10 | One small linear validation pass occurs only at startup |
| User experience / observability | 6/10 | 9/10 | Visitors receive stable recovery while developers retain the exact cause |

**Lesson / process improvement:** Checked-in data tests prove the repository
artifact, not the browser boundary. Validate again after fetch/cache
deserialization, and assign shared runtime state only after the whole payload
passes so partial data cannot escape.

**Next opportunity:** Add a browser startup/day-navigation/translation smoke
that executes real DOM boot and passage cancellation integration. Workspace
next: rotate to AIly after this ChristoDay cycle.

### Cycle 30 — Exercise the reading journey in Chromium (2026-08-11)

**Why this won:** The pure suites strongly covered schedule, API, persistence,
and workflow boundaries but never booted their combined DOM application. Script
ordering, selectors, event binding, passage replacement, and translation
persistence could regress together while every focused contract stayed green.

**Plan and success criteria**

1. Boot the fetched and validated plan in a real Chromium page without relying
   on third-party availability.
2. Render a deterministic Matthew date, navigate to Mark, and overlap a slow
   NIV fetch with a newer ESV request.
3. Prove the newer passage stays visible and persisted after stale work settles,
   with page/console errors treated as failures.
4. Lock exact dependencies and run the browser gate in CI after cheap suites.

**Changes**

- Added exact Playwright `1.62.1` test metadata and lockfile plus a single-worker
  local-server Chromium configuration.
- Added a browser journey that boots the live DOM, selects 2026-06-16, verifies
  Matthew 1:1-17, navigates to Mark 1:1-8, and switches from a delayed NIV
  response to ESV.
- Asserted final passage text/status, saved global/day translation state, fatal
  visibility, and absence of page or console errors after the stale window.
- Stubbed external Bible/font/support requests and blocked service workers so
  the integration stays deterministic while all application assets remain real.
- Added locked dependency caching/install and Chromium execution to CI after
  syntax; expanded workflow policy from 18 to 24 assertions.
- Documented local commands, ignored generated browser output, and bumped the
  site/offline cache version to `2026.08.11.2`.

**Verification evidence**

- Test-first: the expanded policy suite failed on missing npm dependency caching
  before workflow implementation.
- Browser journey: 1/1 passed in 1.9 seconds, then 3/3 overlap repetitions
  passed in 4.1 seconds without runtime errors.
- Workflow policy: 24; schedule/data/schema: 49; Bible client: 12; persisted
  state: 10; site/offline structure: 11 precache entries.
- Clean lockfile installation reported zero npm vulnerabilities.
- Recursive application/tool/service-worker syntax, JSON parsing, and
  `git diff --check`: passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 7/10 | 9/10 | Combined boot/navigation/translation behavior now gates deployment |
| Test coverage / verifiability | 6/10 | 10/10 | Fast contracts are supplemented by a deterministic real-DOM journey |
| Maintainability | 8/10 | 9/10 | One conventional spec owns the cross-module user path and commands are documented |
| Performance / resources | 9/10 | 8/10 | Runtime is unchanged; Chromium adds CI setup after cheap gates pass |
| Security / robustness | 8/10 | 10/10 | Unexpected browser errors fail and the test makes no uncontrolled external calls |

**Lesson / process improvement:** Cancellation tests are strongest when the
obsolete response is deliberately held past the newer response and the DOM is
checked again after that stale window. Keep browser fixtures at public user
boundaries while injecting deterministic data only at network edges.

**Next opportunity:** Run a controlled installed-service-worker/offline reload
journey; the current structural precache check and browser smoke do not prove
the deployed shell actually survives loss of network. Workspace next: rotate to
AIly after publishing this ChristoDay verification cycle.

### Cycle 31 — Verify offline reload and isolate cache cleanup (2026-08-11)

**Why this won:** Structural checks proved that precache paths existed, but the
only browser suite explicitly blocked service workers. Inspection also revealed
that activation deleted every other Cache Storage entry. Cache Storage is
origin-wide, so on the shared GitHub Pages origin ChristoDay could evict another
project's offline cache even though service-worker control is path-scoped.

**Plan and success criteria**

1. Install and control the real page in a dedicated worker-enabled browser
   context while preserving the cancellation-focused worker-blocked journey.
2. Seed both a foreign cache and an obsolete ChristoDay cache; preserve the
   former and remove only the latter during activation.
3. Disconnect Chromium, reload through the active worker, and render a
   deterministic reference-only reading from cached shell and plan assets.
4. Keep unexpected page/console failures fatal while allowing only the known
   optional support script to be unavailable offline.

**Changes**

- Added a `christoday-` cache ownership prefix and limited activation cleanup to
  obsolete cache names within that prefix.
- Added separate Playwright projects: the existing reading/cancellation journey
  still blocks workers, while the offline journey allows a clean worker lifecycle.
- Added a worker-enabled browser test that seeds origin-wide cache sentinels,
  waits for control, checks cache ownership, disconnects the browser, and proves
  the document, stylesheet, application module, and plan JSON came from the worker.
- Verified the offline page renders Matthew 1:1-17 with the documented live-text
  fallback and no application errors.
- Added a fast structural cache-ownership contract, documented the browser
  topology, and bumped the site/offline cache version to `2026.08.11.3`.

**Verification evidence**

- Test-first: the worker-enabled run received only
  `christoday-2026.08.11.2`; both the seeded foreign cache and obsolete local
  cache had been deleted, proving the origin-wide eviction defect.
- `npm run test:browser -- --repeat-each=3`: 6/6 reading and offline journeys
  passed in 6.1 seconds; the offline navigation and four critical assets each
  reported service-worker delivery.
- Workflow policy: 24; schedule/data/schema: 49; Bible client: 12; persisted
  state: 10; site/offline structure: 11 precache entries plus cache ownership.
- Recursive application/tool/test, service-worker, and Playwright syntax checks
  passed; JSON artifacts parsed; npm audit found zero vulnerabilities;
  `git diff --check` passed.

**Scores (change-specific)**

| Dimension | Before | After | Evidence |
|---|---:|---:|---|
| Correctness / reliability | 4/10 | 9/10 | Activation no longer deletes other same-origin projects' caches |
| Test coverage / verifiability | 4/10 | 10/10 | A real installed worker now gates offline shell and plan recovery |
| Maintainability | 6/10 | 9/10 | Cache ownership is named and browser modes are isolated by project |
| Performance / resources | 8/10 | 8/10 | Runtime strategy is unchanged; one small browser journey is added after cheap checks |
| Security / robustness | 4/10 | 9/10 | Origin-wide storage mutation is constrained to ChristoDay-owned names |
| Offline user experience | 6/10 | 9/10 | A disconnected reload reaches a usable deterministic reading and honest text fallback |

**Lesson / process improvement:** Service-worker scope does not scope the Cache
Storage namespace. Every worker on a shared origin needs an explicit ownership
prefix, and cleanup tests should seed foreign state before activation. Separate
browser projects are a clean way to keep one integration test worker-free while
exercising the real worker lifecycle in another.

**Next opportunity:** Restrict runtime caching to URLs within the worker's
registration scope and attach cache writes to `event.waitUntil`, preventing
out-of-scope same-origin support assets or terminated background writes from
weakening cache ownership. Workspace next: rotate to AIly after this
service-worker cycle.
