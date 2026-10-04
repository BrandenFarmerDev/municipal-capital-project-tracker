# Quiet Enterprise compliance report

Baseline: Quiet Enterprise Design Contract 1.0. Scope: the read-only frontend foundation, not the future editing and approval modules.

## Scope implemented

- Stable application shell, project queue, project detail, home, and missing-page states.
- Semantic `--qe-` tokens, `.qe-app` scope, cascade layers, logical dimensions, and comfortable density.
- Named horizontal table regions retain all columns and support keyboard scrolling. Project summaries use one description-list surface instead of individual field cards.
- Native light, dark, and system theme selection, persistence, system-change subscription, and external before-paint initialization compatible with the restrictive CSP.
- Filter clearing, visible sorting and page/result counts, pagination through loading and empty pages, and safe request retries.
- Queue filters and cursor history live in the URL, survive reloads and browser Back, and are retained by the detail page's Back to projects link. Project row links and detail return links provide actual targets at least 44px high.
- Runtime validation of project responses and calendar dates prevents malformed responses from crashing rendering. Failure messages distinguish temporary outages, missing owner configuration, network timeouts, and unreadable sign-in responses.

## Existing components reused

`Layout`, `PageHeader`, `StatusBadge`, `StateMessage`, and `ApiStatus` retain native headings, landmarks, links, labels, status text, and live announcements.

## Tokens or components added

Canonical typography, spacing, shape, color, focus, control-size, motion, and surface roles replace local styles. Product extensions are `--qe-color-control-border` for discernible form boundaries and `--qe-fact-min` for responsive description lists.

| Component | Purpose and anatomy | Variants and states | Keyboard, semantics, and responsive behavior | Example |
| --- | --- | --- | --- | --- |
| `Layout` | Application shell with skip link, brand, primary navigation, theme control, main outlet, and fictional-data footer | Current navigation link; route changes move focus to the page heading | Native links and landmarks; main skip target; utilities wrap and content stays within the viewport | `<Route element={<Layout />}>...</Route>` |
| `PageHeader` | Page identity with one `h1`, optional description, and optional action cluster; updates document title | Title-only or title with supporting text/actions | Programmatically focusable heading; actions retain native keyboard behavior; header and labels wrap | `<PageHeader title="Projects" description="Synthetic capital projects, oldest first." />` |
| `StatusBadge` | Inline business status with a readable label and semantic status color | On track, At risk, Delayed, On hold, Cancelled; static display | Noninteractive text; meaning does not depend on color; label wraps without hiding content | `<StatusBadge status="at_risk" />` |
| `ApiStatus` | Home-page API connection notice with status text and tone | Checking, connected, unavailable; obsolete request aborts on unmount | Polite status announcement; reload guidance in unavailable state; text wraps on narrow screens | `<ApiStatus />` |
| `ThemeSelect` | Visible Theme label around a native select | System, Light, Dark; hover, focus, active; storage failure retains the session choice | Native select operation; 44px minimum target; follows system changes and cleans up listeners | `<ThemeSelect />` |
| `StateMessage` | Persistent loading paragraph or error region with retry action | Informational loading and danger error; retry starts loading and preserves selection | `status` and `alert` announcements; native retry button; wraps on narrow screens | `<StateMessage state={state} loading="Loading projects..." retry={retry} />` |
| `.qe-button` | Native action button or navigation link | Secondary by default, primary via `data-variant`; hover, focus, active, disabled | Native keyboard operation; 44px minimum target; labels wrap naturally; reduced-motion feedback | `<button className="qe-button" type="button">Clear filters</button>` |
| `.qe-table-region` | Named region around a captioned semantic table, with visible scrolling guidance | Populated data; page-level loading, failure, and empty states | Focusable region enables keyboard scrolling; full record identity and columns remain available at narrow widths | Projects and Milestones tables |

Buttons use short action labels; badges keep established business status terminology; table text is left aligned and comparable amounts and sequences are right aligned with tabular numerals. There are no editable fields, dialogs, drawers, destructive actions, or toasts in this foundation.

## States verified

- Automated tests exercise loading, success, unavailable, owner configuration, connection failure, timeout, unreadable and invalid payloads, dataset-empty, filtered-empty, retry, pagination, and filter clearing.
- Keyboard interaction tests cover navigation, theme selection, filtering, and pagination. Controls have default, hover, focus-visible, active, and applicable disabled styles.
- Cancellation tests prove stale responses are ignored and obsolete requests are aborted.
- Invalid editable fields and consequential action confirmations are not applicable to this read-only scope.

## Themes verified

- Light, dark, explicit preference persistence, system updates, and unavailable browser storage are covered by tests.
- Before-paint bootstrap tests cover both explicit themes, system preference, invalid preferences, and storage failure.
- Contrast tests enforce normal-text 4.5:1 and focus/control-boundary 3:1 ratios for both token palettes, including primary hover and active states and all status pairs.

## Accessibility verified

- Page heading and landmark semantics, skip navigation, route focus, visible labels, readable status text, and live announcements are covered by component tests and axe checks.
- Unit-test axe runs exclude color contrast because jsdom cannot measure it; dedicated mathematical token contrast tests cover the used color pairs.
- Reduced motion removes the button transition. Named scroll regions expose guidance without hiding business fields.
- Live Chrome checks covered responsive reflow, keyboard table scrolling, project detail navigation and focus, both themes, retry recovery, and emulated reduced motion (computed button transition `0s`). See `qa.md` for evidence and limits.

## Responsive widths verified

Chrome layout checks passed at 1536px and 390px widths with no page horizontal overflow. Named table regions retain horizontal scrolling and sticky record identity. A 60-record fictional dataset exercised long labels, maximum supported budgets (`$90,071,992,547,409.91`), filtering, and 25-record pagination. A 768px CSS viewport with device scale factor 2 checked reflow equivalent to a 200% desktop zoom viewport; actual Chrome menu zoom was not verified. Temporary emulation settings were reset. The ignored fixture API applies the real migrations and synthetic seed to an in-memory database, then makes it query-only. It does not change production authentication.

## Exceptions

- **Canonical dark primary-hover token:** `#4b82aa` gives white normal text approximately 4.14:1 contrast. The product token uses `#42779e` (approximately 4.81:1) to meet the contract's overriding WCAG AA requirement. Scope: dark primary-action hover only; hierarchy and all other themes remain equivalent. Permanent accessibility correction; no additional component variant or temporary exception owner is needed.
- **Control boundary token:** canonical quiet borders communicate static separation but do not meet 3:1 on form controls. `--qe-color-control-border` uses the theme's muted foreground palette (`#5f6f7f` / `#98a7b5`) for native selects and secondary buttons. Scope: interactive boundaries; improves accessibility in both themes and leaves standard surfaces quiet.

## Remaining risks or follow-up

Actual browser-menu zoom and a full assistive-technology audit remain follow-up verification. Broader product modules need their own state and accessibility review when implemented. Passing automated tests does not prove complete WCAG compliance.

## Post-merge live review: October 4, 2026

A high-end reviewer (`gpt-6-astra`) checked the owner-authenticated production application and the isolated live preview with 32 clearly fictional projects and three milestones. Desktop, 390px, and 320px checks covered controls, keyboard navigation, horizontal table scrolling, route focus, both themes and system changes, filter combinations, pagination, missing routes, network failure/retry, maximum supported budgets, long labels, and reduced motion. Two confirmed contract/usability findings were corrected: queue context lost after detail navigation, and undersized project/return links. The review also prompted clearer initial and later-page empty-state guidance. Independent cost-effective QA (`gpt-6-luna`) reproduced both findings and reviewed the fixes; live retest evidence and remaining verification limits are recorded in `qa.md`.
