# ChristoDay

Christ-centered **weekday gospel reading** in 5–10 minute natural segments (Matthew, Mark, Luke, Philippians, and Jude).

**[Open ChristoDay](https://alphaeusng.github.io/ChristoDay/)** · [Alphaeus Ng](https://alphaeusng.github.io/)

The live site *is* the demo. Today's weekday passage is already picked for you.

## Why it exists

Most plans measure chapters finished. ChristoDay measures *Christ seen*.

- Fixed weekday map: Mon Jude · Tue Matthew · Wed Mark · Thu Philippians · Fri Luke
- Weekends are rest, not guilt
- Schedule math is Asia/Singapore
- Optional live Scripture, a private on-device journal, and streaks
- Prompts aimed at Jesus' person, work, and gospel glory

Pairs with [VerseKeep](https://alphaeusng.github.io/VerseKeep/) for memory practice.

## Try it

1. Open **[ChristoDay](https://alphaeusng.github.io/ChristoDay/)**.
2. Read today's segment (or jump to another weekday).
3. Use a reflection prompt, then write in the journal if you want. Journal and completion stay on this device only. Nothing is uploaded.
4. Come back tomorrow. Streaks follow the Singapore calendar. Saturday and Sunday are rest.

Plan epoch starts **2026-06-15** (Monday, SGT). Segments live in `data/segments.json`.

## Develop

Zero-build HTML/CSS/JS. GitHub Pages from `main` / root.

```bash
npm ci --ignore-scripts
python3 -m http.server 8091
# http://127.0.0.1:8091/

npm run test:browser
```

MIT © 2026 Alphaeus Ng
