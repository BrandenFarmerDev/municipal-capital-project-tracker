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
