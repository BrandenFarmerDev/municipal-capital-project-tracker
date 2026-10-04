# QA

Run `npm run quality`. Gates, in order: ESLint (0 warnings), Vitest coverage (>=85% per workspace), jscpd (<2.99%), `cf:types:check`, strict typecheck, build, local D1 migration, `npm audit` (0 vulnerabilities).

- Backend tests use a `node:sqlite` D1 adapter with `PRAGMA foreign_keys = ON`, the numerically sorted complete numbered migration chain, and a mocked JWKS; no Cloudflare access is needed.
- Frontend tests use jsdom, a mocked API, and axe-core accessibility checks.
- Manual checks once deployed: Access login as the owner, project list filters/pagination, detail view, and that a non-owner is refused.
- All data is fictional.

## Production-readiness review: October 3, 2026

Scope is the implemented read-only foundation, including source, contracts, migration, auth, deployment tooling, dependencies, and the Quiet Enterprise UI contract. Future editing, approval, and reporting modules are not implemented by this review.

The implementation review and separate backend critic surfaced deployment-verifier overstatement, incomplete deployment configuration validation, stale documentation, request lifecycle and payload handling gaps, and UI contract/accessibility gaps. Confirmed findings were corrected. A suspected money precision defect was independently checked and rejected. Purposeful security/configuration comments were retained; no redundant source comments requiring removal were identified.

Fresh independent QA used a separately configured fast GPT-family reviewer (`gpt-6-luna`, high reasoning) and made no source changes. The user explicitly permitted the same model family. This was independent review context, not a claim of different model families or independently operated cloud accounts.

Both the implementation agent and independent reviewer passed `npm run quality`: **276 tests**, backend/shared/root coverage 100% in every metric; frontend coverage **99.42% statements, 97.08% branches, 98.55% functions, 99.22% lines**; duplication **0.00%**; lint **0 warnings**; strict typecheck, generated Worker types, builds, and local migration passed; dependency audit **0 vulnerabilities**. Preview and production deployment guards and Worker dry-run builds also passed using synthetic secret-presence values.

Chrome fixture checks passed for 1536px and 390px layouts, both themes, detail navigation, accessible route focus, keyboard table scrolling with sticky identity, empty filter results and clearing, dense pagination, long fictional labels, maximum budgets, API failure messaging, and successful retry. Reduced motion was emulated and produced `0s` transitions. A 768px CSS viewport at device scale factor 2 passed zoom-equivalent reflow; actual browser-menu 200% zoom remains unverified. Emulation was reset after testing. The fixture applied the real migration and local fictional seed to query-only in-memory SQLite, without changing production auth.

Live production and preview verification: unauthenticated site/API requests redirect to the expected Access application; the inspected Allow policy contains only the owner email. After Cloudflare sign-in and custom-domain activation, the owner's cross-origin project request returned **200** in both environments and the frontend showed the expected empty remote dataset. No remote project fixtures were inserted. The initial domain-provisioning 522 and transient fetch failure recovered after activation/retry. A live non-owner identity was not used; signature/audience/issuer/expiry and non-owner rejection are covered by mocked-JWKS tests.

GitHub quality and CodeQL checks passed for implementation commit `9130871`. The repository reported no open code-scanning alerts for PR #1's merge ref and no open secret-scanning alerts at the time of review. This documents the observed checks and alert state, not a guarantee against future findings.

Credential setup completed after user approval on October 3, 2026: the scoped Cloudflare token was created, saved in Bitwarden and GitHub, and automated deployment enabled. [Preview workflow run 37182773234](https://github.com/BrandenFarmerDev/municipal-capital-project-tracker/actions/runs/37182773234) passed quality gates, migration checks, Worker and Pages deployment, and Access verification using the stored token. Production remains on the previously verified manual deployment until PR merge triggers its automated release.

The initial independent reviewer reported no confirmed source defects but withheld overall approval while docs and live checks were in progress. Its final documentation review passed with two corrections: clarify token status and complete the component inventory. Both corrections were applied, and credential and deployment checks are now complete for the implemented read-only foundation. The browser and identity verification limits above remain recorded. Checks and review do not establish absence of all possible bugs.

## PR review fixes: October 4, 2026

All four findings from [Copilot review 5404663998](https://github.com/BrandenFarmerDev/municipal-capital-project-tracker/pull/1#pullrequestreview-5404663998) were corrected: real UTC calendar timestamps and canonical cursor UUIDs, encrypted owner-email bindings instead of committed personal values, isolated Worker names/custom-domain routes/Access audiences, and automatic migration discovery in SQLite tests. Regression tests cover impossible dates/times, malformed UUIDs, HTTP 400 responses, reused resources, and an ordered multi-file migration chain with non-migration files excluded. Applied migration `0001` was not edited.

A fresh independent rubber duck agent (`gpt-6-luna`, high reasoning) found one remaining guard gap: an owner email reintroduced in root Wrangler variables was not rejected. The static guard now rejects owner variables at root and in every environment, with regressions for all scopes. The reviewer then passed the fixes with no further confirmed defects.

The independent full quality run passed, followed by root coverage, lint, and strict typecheck after the final guard patch: **308 tests** total (backend 97, frontend 122, shared 44, root 45). Backend/shared/root coverage remains **100% in all metrics**; frontend coverage remains **99.42% statements, 97.08% branches, 98.55% functions, 99.22% lines**. Duplication is **0.00%**, audit vulnerabilities **0**, and lint warnings **0**. Generated Worker types, builds, and local migrations passed.

Both remote Workers were deployed atomically with encrypted `OWNER_EMAIL` bindings; secret-list metadata confirmed `secret_text` in production and preview. Fresh owner browser requests still loaded the expected empty remote dataset in both environments. Direct browser navigation to a malformed-cursor API URL was blocked by the client, so HTTP 400 evidence is from regression tests rather than that live check. No Access policies were changed.

## Post-merge live UI review: October 4, 2026

PR #1 merged as `211d3fc`; the [production workflow](https://github.com/BrandenFarmerDev/municipal-capital-project-tracker/actions/runs/37214126790) passed quality gates, migration checks, Worker/Pages deployment, and Access challenge verification. A high-end reviewer (`gpt-6-astra`, high reasoning) inspected the actual owner-authenticated production application. Production remained empty; meaningful populated checks used 32 temporary, uniquely marked fictional projects and three milestones in the isolated preview D1 database.

The live review covered home/API connection, navigation, document titles and route focus, skip navigation, light/dark preference persistence and system changes, combined filters and clearing, pagination, detail and milestone tables, missing pages/projects, offline failure and retry recovery, keyboard horizontal scrolling with sticky identity, long labels, maximum supported and zero budgets, absent dates, reduced motion (`0s` transitions), and 1440px/390px/320px layouts without page overflow. Two P2 findings were independently reproduced by cost-effective QA (`gpt-6-luna`, high reasoning): returning from detail discarded filters/pagination, and project/return links missed the design contract's 44px target minimum. The latter is a contract finding, not an assertion that every small link necessarily violates WCAG 2.5.8's spacing exceptions.

Fixes retain queue filters and cursor history in the URL, carry that context into detail navigation, and expand the actual link targets. Initial and later-page empty states now provide the appropriate next step. Regression tests cover detail return and browser Back, multi-cursor history, filter reset, invalid bookmarked filters, and safe return-path construction. Independent QA found no additional confirmed source defect in the fixes.

Independent live QA verified fresh preview assets (`index-cFgYtGzS.js`, `index-Dt_B7xKR.css`): combined Construction/On track filters survived detail return; page two (seven records) survived detail return, reload, and browser Back; Previous restored page one (25 records). Direct bookmarked filtered/cursor URLs loaded correctly, and changing a filter cleared cursor history. All 25 project anchors measured at least 44px high at both 390px and 320px; detail return links measured 44px in both layouts. Neither width produced page overflow. Keyboard focus, horizontal table scrolling, and Light/Dark/System controls worked. This was actual deployed preview behavior, with no auth bypass.

The temporary preview fixtures were removed after QA using their known IDs, fictional tenant, and creation marker. Remote counts confirmed zero projects and milestones in preview; production independently remained at zero throughout. Reviewers restored System theme and reset browser emulation. The fix retest covered preview; the initial high-end review covered production before these fixes.

The full local `npm run quality` passed: **319 tests** (backend 97, frontend 133, shared 44, root 45). Backend/shared/root coverage is **100% in every metric**; frontend is **99.45% statements, 97.40% branches, 98.55% functions, 99.29% lines**. Duplication is **0.00%**, lint warnings and dependency vulnerabilities are **0**. Strict types, generated Worker types, builds, and local migrations passed.

Actual browser-menu zoom, screen-reader testing, a live non-owner identity, and every transient server response remain unverified. Contrast is covered by token calculations and visual inspection rather than a full rendered contrast audit. This review does not establish complete WCAG compliance or absence of all possible bugs.

## Persistent production demonstration data: October 4, 2026

After the review, the owner explicitly requested a populated production prototype. The optional `app/backend/seed/production_fictional_demo.sql` was applied to the confirmed empty production D1 database, adding **60 fictional projects and 275 milestones**. These records are persistent demonstration content, distinct from the removed preview QA fixtures. No migration, application code, authentication, or Worker configuration changed.

Before import, the seed passed the actual migration chain and foreign-key constraints in SQLite. Validation checked all seven project phases, five project statuses, four milestone statuses, valid dates and safe integer budgets, zero budgets, absent dates, and repeat application without duplicates or overwriting existing records. Remote production counts and foreign-key checks passed. The production browser verified pages of **25 / 25 / 10**, last-page Next disabled, combined Construction/On track filtering (two results), populated details with complete/in-progress/planned milestones, filter-preserving detail return, zero budget and missing dates, and a project without milestones. The existing Dark preference was preserved; no browser emulation was introduced. The full `npm run quality` also passed all **319 tests** and existing gates.
