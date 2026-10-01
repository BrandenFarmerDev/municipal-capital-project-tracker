# Municipal Capital Project Tracker

**Status: Prototype — in development.** This repository currently contains project documentation and a `.gitignore`; application code and a working demo have not been implemented.

A synthetic-data prototype for tracking public capital projects from request through construction and closeout. Its purpose is to keep project status, budget changes, decisions, and public updates connected to a shared history.

## Planned scope

- Represent a capital project's lifecycle from request to closeout.
- Track status changes, budget revisions, and the decisions behind them.
- Present clear project summaries and SVG views using synthetic examples.
- Separate public updates from internal notes and require deliberate publication of public-facing information.

## Intended stack

React, TypeScript, Cloudflare Workers, Cloudflare D1, and SVG data views. The schema, access roles, and publication workflow will be finalized during implementation.

## Data boundaries

The public demo will use fictional projects, budgets, and participants. Do not commit employer, municipal, resident, procurement, or confidential project records. Demo values illustrate the workflow and are not claims about a real municipality or completed delivery.

This application will have its own Worker and D1 database. Private records will not be shared with the portfolio database or used as retrieval sources for Ask Branden. Public views must expose only deliberately published fields.

## Getting started

Clone the repository to begin implementation:

```sh
git clone https://github.com/BrandenFarmerDev/municipal-capital-project-tracker.git
cd municipal-capital-project-tracker
```

There are no install, development, test, or deployment commands yet. Add reproducible setup and quality checks alongside the first application implementation. Keep secrets in local ignored configuration or Worker secrets; `VITE_` variables are public.

## Portfolio

- [Project outline](https://brandenfarmer.com/work#municipal-capital-project-tracker)
- [Portfolio source](https://github.com/BrandenFarmerDev/branden-farmer-portfolio)
