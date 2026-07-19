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
python3 -m http.server 8091
node tools/test-schedule.mjs
node --check js/schedule.js && node --check js/bible.js && node --check js/app.js
```

## Conventions

- Zero-build; dark gold portfolio aesthetic
- Schedule must stay deterministic; tests cover start week + Jude rotation
- Do not ship secrets; journal is localStorage only
