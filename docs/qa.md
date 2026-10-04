# QA

Run `npm run quality`. Gates, in order: ESLint (0 warnings), Vitest coverage (>=85% per workspace), jscpd (<2.99%), `cf:types:check`, strict typecheck, build, local D1 migration, `npm audit` (0 vulnerabilities).

- Backend tests use a `node:sqlite` D1 adapter with `PRAGMA foreign_keys = ON` and a mocked JWKS; no Cloudflare access is needed.
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

Overall operational readiness remains **pending** until the deployment credential is created and saved in Bitwarden/GitHub and final GitHub CI/security results are recorded. The initial independent reviewer reported no confirmed source defects but withheld overall approval while docs and live checks were in progress. Its final documentation review passed with two corrections: clarify that token scopes are planned, and complete the component inventory. Both documentation corrections were applied. Checks and review do not establish absence of all possible bugs.
