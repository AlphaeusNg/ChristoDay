# AGENTS.md — ChristoDay

**Live:** https://alphaeusng.github.io/ChristoDay/  
**Local:** `/home/alph/projects/ChristoDay`  
**Hub:** `/home/alph/projects/AGENTS.md`

## Purpose

Weekday Christ-centered gospel reading plan (Matthew / Mark / Luke / Philippians / Jude). Static site.

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

## Conventions

- Zero-build; dark gold portfolio aesthetic
- Schedule must stay deterministic; tests cover start week + Jude rotation
- Invalid or unreachable fetched plan data must stay on the user-safe fatal recovery surface
- Do not ship secrets; journal is localStorage only
