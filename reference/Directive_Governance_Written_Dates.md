# Directive: Governance module — written dates through the family helper

**Issued:** September 5, 2026, by Paul Scade. **Applies to:** the "90 Days to Responsible AI Governance" app (Governance-app.js). **Authority:** Family Standard Spec §17A and Cross-Module Rollout List item 76, both entered at Revision AM on this date.

## What to change, in one sentence

Every date the Governance app shows to a user as text must be printed through the app's own date helper, so it reads `Oct 14, 2026`, and must never appear as `2026-10-14` or as a numeric date such as `14/10/2026`.

## Why

The app already has the helper. `fmtDate(ts)` at line 468 of Governance-app.js prints a stored date as `Oct 14, 2026`, and `fmt(d)` at line 1262 does the same. Some surfaces use it and some print the stored value raw, so a user sees `Oct 14, 2026` on one card and `2026-10-14` on the next. The raw form is ambiguous between UK and US readers. The month form is not.

## What stays the same

1. **Stored values.** Do not change how dates are stored. They stay as `YYYY-MM-DD` strings or timestamps. Only what the user reads on the page changes.
2. **Date pickers.** Every `<input type="date">` stays as it is. The browser shows it in the user's own format. Keep the existing wiring from Rollout item 18: save on `change` without re-rendering, re-render on `blur` through `deferRender()`.
3. **Free text.** If a field lets the user type a horizon rather than a date, for example "60 days" or "this quarter", print it exactly as typed. The helper is only for values the app knows to be dates.

## The rule for each site

Wherever a stored date is put into HTML that the user reads, replace the raw value with a call to `fmtDate(value)`. Use `fmtDate`, not `fmt`, for stored `YYYY-MM-DD` strings: it reads the string at local noon, so the day does not shift when the user's time zone is west of UTC. If the value can be empty, keep whatever empty-state text the site already shows ("Date not set", "—").

Wrong: `'<div>'+(rc.firstReviewDate||'Date not set')+'</div>'`

Right: `'<div>'+(rc.firstReviewDate?fmtDate(rc.firstReviewDate):'Date not set')+'</div>'`

Wrong: `d.toISOString().split('T')[0]`

Right: `fmtDate(d)`

## Known sites

These were found by reading Governance-app.js at md5 `db0200df` (8,112 lines). Line numbers are from that build. Fix these, then run the search below, because there may be more.

1. **The dashboard's three review boxes.** Around lines 6506–6509: `rc.firstReviewDate`, `_eb.nextReview`, and `gr.firstMeeting` are printed raw beneath the cadence ("Weekly", "Monthly"). Each becomes `fmtDate(...)` with the existing "Date not set" fallback kept.
2. **The review log card.** Around line 4613, inside `govReviewLogCard`: `d.toISOString().split('T')[0]` becomes `fmtDate(d)`.
3. **The risk register.** Around lines 4360, 4995, and 5009: `esc(r.loggedAt)` becomes `fmtDate(r.loggedAt)` where the value is a date.
4. **The decision log.** Around line 5282: `new Date(e.at).toISOString().split('T')[0]` becomes `fmtDate(e.at)`.
5. **Around line 7176:** `esc(it.date)` becomes `fmtDate(it.date)` if that value is a stored date; if it can be free text, leave it.
6. **Any other site the search finds.**

## The search

Run these against Governance-app.js and read every hit:

- `toISOString().slice(0,10)` and `split('T')[0]` — keep the ones that *store* a date (for example `stepDoneAt[...] = new Date().toISOString().split('T')[0]`); change the ones that put the date into HTML.
- `esc(` followed by a field named `date`, `due`, `loggedAt`, `nextReview`, `reviewedAt`, `firstMeeting`, `firstReviewDate`, `deadline`, `revisit`, or `at` — change the ones that are stored dates.
- Any `Date not set` or `—` fallback next to a raw date value.

## Done means

1. Sign in to the seeded demo organization and open every page: Home, Framework, every step in every phase, the Dashboard with every fold open, Analytics, every output document, and the Track Program page. No date in visible text reads as `2026-10-14`. Every date reads as `Oct 14, 2026`. The only place the ISO form may appear is inside a date input's `value` attribute.
2. Print any output document to PDF. The dates on the print read the same way.
3. Add one test to the module's harness that renders the dashboard and the review log in the seeded world and fails if visible text matches `\d{4}-\d{2}-\d{2}` outside an `<input type="date">`.
4. The smoke suite and the harness pass with zero failures.
5. Report back the list of sites changed, with line numbers, and the harness count before and after.

## Do not

- Do not write a new date formatter. Use the two that exist.
- Do not change how dates are stored, or the migration that stamps `stepDoneAt`.
- Do not change the date pickers or their save-on-change, render-on-blur wiring.
- Do not localize the printed form to the browser. The family law is the month form for every user.
