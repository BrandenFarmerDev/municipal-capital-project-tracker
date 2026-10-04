# Deployment

Provisioned on October 3, 2026 (America/Los_Angeles). Scope is the read-only fictional-data foundation in `architecture.md`.

## Resources

| Resource | Production | Preview |
| --- | --- | --- |
| Worker | `municipal-capital-project-tracker-api` | `municipal-capital-project-tracker-api-preview` |
| API hostname | `capital-api.brandenfarmer.com` | `capital-api-test.brandenfarmer.com` |
| D1 name | `municipal-capital-project-tracker-production` | `municipal-capital-project-tracker-preview` |
| D1 ID | `2beaf9e2-0268-4722-a716-b252944cd289` | `3ad4f96a-ae08-41d8-9a15-f7071a2e15d3` |
| Site hostname | `capital.brandenfarmer.com` | `capital-test.brandenfarmer.com` |
| Pages branch | `main` | `preview` |
| Access application | `7dcaf0bf-6fcd-44ca-ad80-d5fcd015d858` | `6b52727c-5d1a-46c3-8c96-248601006162` |

The Pages project is `municipal-capital-project-tracker`. Both Workers and Pages branches were uploaded manually using the existing Wrangler OAuth session. Migration `0001_initial_schema.sql` is applied remotely in both D1 databases. The migration creates the fixed fictional demonstration tenant; the local project seed was not applied remotely, so the deployed project list starts empty.

Both custom domains are active and owner-authenticated cross-origin browser requests to `/api/projects` returned 200 in both environments. See `qa.md` for current evidence and outstanding work.

## Authentication

Each environment uses one multi-domain Cloudflare Access application for its site and API, with its own AUD recorded in `app/backend/wrangler.jsonc`. The team domain is `cold-union-464d.cloudflareaccess.com`. The only Allow policy is `Portfolio owner only` (`2f08f97a-f619-47d4-abd1-dbe6ca15a943`), whose Include rule is the single email `branden_farmer@live.com`. No application bypass policy is configured. The Worker additionally verifies JWT signature, issuer, audience, expiry, and owner email with `jose`.

HTTP-only and eager redirect cookies are enabled. Eager issuance supplies API-host cookies for browser fetches from the site. Use the canonical custom site hostname: the API permits one exact site origin per environment. Pages default and hashed hostnames are Access-protected alternative asset URLs, not additional permitted API origins.

Production Access also protects `municipal-capital-project-tracker.pages.dev` and `*.municipal-capital-project-tracker.pages.dev`; the more specific preview application protects `preview.municipal-capital-project-tracker.pages.dev`. Worker `workers.dev` and preview URLs are disabled. Local auth deliberately remains unconfigured and protected routes return 503; tests mock JWKS.

Pages needs the HTTP certificate-validation path reachable. Cloudflare completed validation in both environments with the existing protection. A narrowly scoped `/.well-known/acme-challenge/*` exception on the two site hostnames was approved if needed, but has not been created. Never expose application routes to solve a certificate problem. See [Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/).

The preview site's proxied CNAME targets `preview.municipal-capital-project-tracker.pages.dev`; production targets `municipal-capital-project-tracker.pages.dev`. Register custom domains with Pages before changing DNS. See [custom branch aliases](https://developers.cloudflare.com/pages/how-to/custom-branch-aliases/).

## Credentials and automation

GitHub environments `production` and `preview` exist. Repository variable `CLOUDFLARE_PAGES_PROJECT` and each environment's `SITE_ORIGIN` and `VITE_API_BASE_URL` are set. Repository secret `CLOUDFLARE_ACCOUNT_ID` is set. `CLOUDFLARE_API_TOKEN` creation and Bitwarden storage remain pending; the vault is locked. The current JWT-verification design needs no application Worker secrets: team domain, AUD, origin, and owner email are configuration.

The planned deployment token configuration requests account D1, Pages, and Worker Scripts Write, plus Workers Routes Write and Zone Read restricted to `brandenfarmer.com`, with expiry October 4, 2027. This configuration is prepared for approval; no token has been issued. Once approved and created, store its value in Bitwarden and the GitHub Actions secret; never put it in source, logs, or `VITE_` variables. Rotate before expiry. The planned scopes exclude Access administration and DNS Write.

`ENABLE_DEPLOYMENTS` remains `false` until the token is stored and live validation is complete. CI always runs quality gates. Automated deployment runs only after quality succeeds on a push to `main`, or an explicitly dispatched preview deployment from a `bfarmer/*` branch. Pull requests do not deploy. Opening a PR does not merge it.

## Routine release

1. Run `npm ci` and `npm run quality`. After Worker configuration changes, run `npm run cf:types`.
2. Run `node scripts/validate-deployment.mjs <preview|production>` with that environment's variables and secret-presence values. The guard rejects placeholders, reused resources, malformed auth configuration, and API URLs that do not match the Worker custom domain.
3. Apply additive migrations from `app/backend`: `npx wrangler d1 migrations apply MCT_DB --remote --env <environment>`.
4. Deploy the Worker with `npx wrangler deploy --env <environment>`.
5. Build the frontend with the environment's public `VITE_API_BASE_URL`, then upload `app/frontend/dist` to Pages with the matching `main` or `preview` branch. CI uses `--force` to retain Pages behavior under Wrangler's agent-specific Worker delegation.
6. Run `node scripts/check-private-deployment.mjs` with `DEPLOY_ENVIRONMENT`, `SITE_ORIGIN`, and `VITE_API_BASE_URL`. It verifies the configured Access login challenge, not the owner policy or signed-in API behavior. Separately inspect the policy and verify owner flow and non-owner denial.

Preserve backups before consequential future migrations. Do not roll back D1 by editing an applied migration; add a corrective migration. Worker and Pages versions can be rolled back independently after checking contract compatibility.
