# CI readiness: Ubuntu 26.04

## Context

GitHub moves `ubuntu-latest` to Ubuntu 26.04 starting 19 Oct 2026: [runner-images announcement](https://github.com/actions/runner-images/issues/14748). Checked 14 Oct 2026.

## Probe

Probe commit `95ae19648173694c79521e2b4f7ef4d75d5bb9c1` set `runs-on: ubuntu-26.04` on the single `test` job in `.github/workflows/ci.yml`.

[Probe run](https://github.com/AlphaeusNg/ChristoDay/actions/runs/38497277071) concluded **success**.

- Image: `ubuntu-26.04`, version `20260927.149.1` ([included software](https://github.com/actions/runner-images/blob/ubuntu26/20260927.149/images/ubuntu/Ubuntu2604-Readme.md))
- Runner: `2.337.0`
- Node: `24`

| Step | Result |
| --- | --- |
| Set up job | success |
| Run actions/checkout@v7 | success |
| Run actions/setup-node@v7 | success |
| Install locked dependencies | success |
| Workflow policy | success |
| Schedule tests | success |
| Bible client tests | success |
| Persisted state tests | success |
| Journal history tests | success |
| Offline reading tests | success |
| Reading calendar export tests | success |
| Singapore day rollover tests | success |
| Site and offline structure | success |
| Service worker behavior | success |
| JavaScript syntax | success |
| Install Chromium | success |
| Browser reading journey | success |
| Post Run actions/setup-node@v7 | success |
| Post Run actions/checkout@v7 | success |
| Complete job | success |

Install Chromium (`npx playwright install --with-deps chromium`) installed apt system deps and Chrome Headless Shell `151.0.7922.34` without errors.

## Revert

The probe was undone with a plain `git revert` (revert commit `d24589be639f2ff587cc242491cd268c188b9c44`). `git diff origin/main -- .github/workflows` is empty, so `ci.yml` still uses `ubuntu-latest`.

## Outcome

**Ready, no fix or pin needed.**

This file lives under `.github/`, which GitHub Pages (legacy Jekyll build from repo root) does not publish.
