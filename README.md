# Global Decarbonization Dashboard

Application source for the climate-transition dashboard, scenario analysis,
company valuation tools, decarbonization signals and news context.

**Current repository:** https://github.com/ahow/climate_implied

This underscore-named repository contains the current Replit application.
The separate `ahow/climate-implied` repository is an earlier related implementation.

## Run

- Install Node.js 20 and dependencies with `npm ci`.
- Configure PostgreSQL using `DATABASE_URL` through secure environment settings.
- Supply optional service credentials securely for news and web-search collection.
- Development: `npm run dev` (port 5000).
- Build: `npm run build`.
- Production: `npm start`.
- Type checking: `npm run check`.
- Targeted regression checks: `npx tsx script/priority1.test.ts`.

Database setup must be reviewed for the target environment; `npm run db:push`
mutates the schema. Uploaded company datasets and production database contents
are not included in this repository.

## Documentation and scientific status

- `docs/Dashboard_Purpose_Methodology_and_Implementation.html`
- `docs/API_Contract.md`
- `docs/Climate_Model_Remediation_Basis.md`

The existing dashboard climate model remains exploratory. The approved FaIR
replacement is not yet integrated. `uv run python script/fair-reference.py`
runs the separate reference example, not a validated dashboard forecast.
Repository synchronization does not certify scientific validity or deploy the app.

## Source synchronization

The user has requested that this repository remain updated as application changes
are made. After reviewing, checking and committing changes in the workspace, run:

```sh
python script/sync-github.py
```

This exports an allowlisted source snapshot to GitHub `main`, preserving a
separate public history rather than copying workspace history containing uploads.
It excludes uploaded documents/data, generated outputs and internal agent files.
It checks for common credential patterns and verifies the remote commit after
pushing. This check is a safeguard, not a complete secret or privacy audit.

Do not run a normal `git push github main`: the workspace's full history is not
the approved public export. Do not force-push. Independent GitHub changes require
review before the export continues.

No background synchronization job is installed: synchronization is a step in
completing changes to this project.
