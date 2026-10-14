# ChristoDay UI sizing audit

Audited 2026-10-14. Release: `2026.10.14.2`.

## Method

Chromium at 320, 375, 768 and 1280 CSS pixels, with root text at 100% and 200%. Each pass opens the calendar, journal history and weekly catch-up, fills a long journal note, and opens a long cross-reference. `tests/browser/reading.spec.mjs` checks document overflow, controls outside the viewport, standalone controls under 24px, and that the reference popover stays on screen and scrolls.

Verse numbers, footnote marks and inline cross-reference links are excluded from the 24px standalone-target check. They sit in the passage line. The share-note checkbox is a native control with its label.

## Findings and fixes

Enlarged reader stats, the date toolbar and a long brand line could force the page wider than a phone. Those rows wrap, and the brand can shrink.

The reference popover could grow past the viewport when a chapter comment was long. It now stays within the screen, wraps its title, and scrolls the comment. The comment region can be focused and paged from the keyboard. Close remains inside the popover.

## Validation

Eight reflow configurations and the full 41-journey reading project passed. All ten Node suites passed.
