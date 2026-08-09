# ChristoDay

**Christ-centered weekday gospel reading** — 5–10 minute natural segments through Matthew, Mark, Luke, Philippians, and Jude.

**Live (after GitHub Pages):** https://alphaeusng.github.io/ChristoDay/  
**Author:** [Alphaeus Ng](https://alphaeusng.github.io/)

## Why this exists

Most reading plans measure *chapters finished*. ChristoDay measures *Christ seen*:

- Fixed weekday map (Mon Jude · Tue Matthew · Wed Mark · Thu Philippians · Fri Luke)
- Weekends are rest — not guilt
- Asia/Singapore timezone (deterministic schedule math)
- Live Scripture (optional) + private on-device journal + streaks
- Reflection prompts that push toward Jesus’ person, work, and gospel glory

Pairs with:

- [VerseKeep](https://alphaeusng.github.io/VerseKeep/) — memory practice  
- [Seeking Biblical Truth](https://alphaeusng.github.io/pages/seeking-biblical-truth/) — study vault  

## Stack

Zero-build static site: HTML / CSS / JS. GitHub Pages from `main` / root.

## Local

```bash
cd /home/alph/projects/ChristoDay
python3 -m http.server 8091
# http://127.0.0.1:8091/

node tools/test-schedule.mjs
node tools/test-bible.mjs
node tools/test-state.mjs
node tools/test-site.mjs
node tools/test-workflow.mjs
find js tools -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | sort -z | xargs -0 -n1 node --check
node --check sw.js
```

## Plan epoch

Start date: **2026-06-15** (Monday, Asia/Singapore). Segment lists live in `data/segments.json`.

## Privacy

Journal and completion state stay in `localStorage` on your device. Nothing is uploaded.

## License

MIT © 2026 Alphaeus Ng
