# Municipal Capital Project Tracker

**Status: Prototype — read-only foundation implemented.** The app lists fictional capital projects and displays project details and milestones. Project editing and the broader construction workflows remain planned.

A synthetic-data prototype for tracking public capital projects from request through construction and closeout. Its purpose is to keep project status, budget changes, decisions, and public updates connected to a shared history.

## Planned scope

- Represent a capital project's lifecycle from request to closeout.
- Track status changes, budget revisions, and the decisions behind them.
- Present clear project summaries and SVG views using synthetic examples.
- Separate public updates from internal notes and require deliberate publication of public-facing information.

## Stack

React, TypeScript, Cloudflare Workers, and Cloudflare D1 in npm workspaces. Protected APIs require a verified Cloudflare Access JWT for the configured owner. SVG views and deliberate publication workflows remain planned.

## Data boundaries

The public demo will use fictional projects, budgets, and participants. Do not commit employer, municipal, resident, procurement, or confidential project records. Demo values illustrate the workflow and are not claims about a real municipality or completed delivery.

This application will have its own Worker and D1 database. Private records will not be shared with the portfolio database or used as retrieval sources for Ask Branden. Public views must expose only deliberately published fields.

## Getting started

Clone the repository:

```sh
git clone https://github.com/BrandenFarmerDev/municipal-capital-project-tracker.git
cd municipal-capital-project-tracker
```

Requires Node 24 (see `.nvmrc`).

```powershell
npm ci
npm run db:migrate:local   # apply the schema to the local D1 database
npm run db:seed:local      # load fictional demo data
npm run dev                # Worker on :8787 and Vite dev server
npm test                   # unit tests
npm run quality            # lint, coverage, duplication, types, build, migration, audit
```

Protected API routes need Cloudflare Access; local configuration uses placeholders, so they return 503 `auth_unconfigured` until real values are set (see `docs/deployment.md`). Keep secrets in local ignored configuration or Worker secrets; `VITE_` variables are public.
## Portfolio

- [Project outline](https://brandenfarmer.com/work#municipal-capital-project-tracker)
- [Portfolio source](https://github.com/BrandenFarmerDev/branden-farmer-portfolio)
