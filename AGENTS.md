# AGENTS.md — ChristoDay

Visitor-facing docs live in [README.md](README.md). This file is for agents and local workflow.

**Live:** https://alphaeusng.github.io/ChristoDay/  
**Local:** `/home/alph/projects/ChristoDay`  
**Hub:** `/home/alph/projects/AGENTS.md`

## Purpose

Weekday Christ-centered gospel reading plan (Matthew / Mark / Luke / Philippians / Jude). Static site. Plan epoch starts **2026-06-15** (Monday, Asia/Singapore). Segment lists live in `data/segments.json`.

Weekday map: Mon Jude · Tue Matthew · Wed Mark · Thu Philippians · Fri Luke. Weekends are rest. Journal and completion state stay in `localStorage`. Nothing is uploaded.

## Structure

```text
index.html
css/style.css
js/version.js      # bump every deploy YYYY.MM.DD.N
js/schedule.js     # Asia/Singapore schedule engine
js/bible.js        # bolls.life live text
js/app.js          # UI, journal, streaks
data/segments.json # plan data
tools/test-schedule.mjs
```

## Commands

```bash
cd /home/alph/projects/ChristoDay
npm ci --ignore-scripts
python3 -m http.server 8091
node tools/test-schedule.mjs
node tools/test-bible.mjs
node tools/test-state.mjs
node tools/test-site.mjs
node tools/test-service-worker.mjs
node tools/test-workflow.mjs
find js tools tests -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | sort -z | xargs -0 -n1 node --check
node --check sw.js
node --check playwright.config.mjs
npx playwright install chromium
npm run test:browser
```

## Tests

Playwright boots the real page with controlled Bible API responses, navigates from Matthew to Mark, overlaps an obsolete NIV request with a newer ESV selection, and verifies the new translation remains rendered and persisted. It forces a malformed live-passage response, proves reference-only reading/journal/completion stay usable, then verifies another translation restores live text. It denies journal storage, proves progress and honest durability guidance survive day navigation, then verifies a later permitted write makes the full entry durable. Invalid plan payload and non-200 `segments.json` must stay on the user-safe fatal recovery surface. A worker-enabled context installs the offline shell at `/ChristoDay/`, verifies unrelated same-origin caches survive activation, rejects out-of-scope runtime writes, and reloads a working reference-only reading from the service-worker cache.

## Conventions

- Zero-build; dark gold portfolio aesthetic
- Schedule must stay deterministic; tests cover start week + Jude rotation
- Invalid or unreachable fetched plan data must stay on the user-safe fatal recovery surface
- Do not ship secrets; journal is localStorage only
- Passage size (A−/A+, −/+) persists on-device with journal/translation state
