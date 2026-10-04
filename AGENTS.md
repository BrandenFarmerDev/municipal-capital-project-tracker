# Project working agreement

- If a local `AGENT_HANDOFF.md` exists at the repo root (gitignored), read it first for the current state of work. Never commit it.
- Work on a descriptive `bfarmer/*` branch. Do not commit, push, or open pull requests unless explicitly asked.
- Follow the npm workspace boundaries: React/Vite in `app/frontend`, Worker/D1 in `app/backend`, serializable contracts and money helpers in `packages/shared`.
- **Synthetic, fictional data only.** Never add real municipal, personal, or financial data. Everything in seeds and fixtures must be clearly fictional.
- **Single-owner auth.** Protected routes require a Cloudflare Access JWT (verified with `jose`) whose email matches `OWNER_EMAIL`. There is no membership table and no local auth bypass; tests mock JWKS. Local `ACCESS_AUD` is a placeholder, so protected routes return 503 `auth_unconfigured` in local dev by design.
- **No secrets in source.** Use Worker secrets or ignored local files. `VITE_` variables are public.
- **Quality bar** (`npm run quality`): at least 85% statements/branches/functions/lines in each workspace, duplication below 3%, 0 audit vulnerabilities, 0 lint warnings, strict typecheck. Do not waive or shrink gates.
- **Migrations are additive-only.** Add new numbered files in `app/backend/migrations`; never edit an applied migration. Soft-deleted `project_number` values stay reserved.
- After Worker config changes run `npm run cf:types`.
- Keep docs aligned with behavior. Do not list Copilot as a commit or PR coauthor.