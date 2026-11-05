# Railway hosting and GitHub deployments

## Intended release process

The user approved moving web hosting to Railway, with automatic deployments
from `ahow/climate_implied`, branch `main`. Once activated, source pushes are
production-release events, not just backups. Keep the code-only export policy;
never commit credentials, raw research extracts, uploads or database dumps.

Project: `climate-implied`. Service: `dashboard`. Environment: `production`.
Railway project: https://railway.com/project/9e5be6c6-c701-4384-8d03-723aa76ecfaf

The repository connection and configuration are initially **staged**. A staged
source is NOT an active automatic-deployment connection. Applying the staged
changes in Railway triggers the first build.

## Secure configuration before the first build

In Railway's service Variables screen, add:

- `DATABASE_URL`: the **existing Replit production** database's external
  connection string, from its Database Settings. Do not use development data,
  create an empty replacement, or share the value in chat or source control.
- `NEWSAPI_KEY`: the existing news-service credential.
- `PERPLEXITY_API_KEY`: only if configured in production for the optional adapter.

The current code does not consume `SESSION_SECRET`; no GitHub personal access
token is required by the running app. Railway's GitHub integration handles
source access. Authorize its access to this repository if requested.

Non-secret staged variables: `NODE_ENV=production`,
`DATA_SCHEDULER_ENABLED=false`. The latter prevents duplicate scheduled
collection while Replit still serves production.

This is initially a **web-hosting migration**, not a database relocation.
Keep the Replit database and its hosting arrangements intact. External
connectivity must be tested from Railway; do not assume it works merely because
the connection string is present.

## Build and readiness

Railpack must use the explicit Node provider in `railpack.json` (Node 22).
This mixed-language repository also contains Python analysis tooling; automatic
detection selected Python alone, leaving the npm build without its required
Node runtime or dependency installation. Python analysis files are retained,
but the current web service does not call Python. Revisit runtime provisioning
when a future physical-model integration actually requires it.

- Build: selected calculation/reference tests followed by `npm run build`.
- Start: `npm run start`.
- Bind: `0.0.0.0`, Railway-provided `PORT`.
- Readiness: `/api/health`, which verifies database access and the indicator
  table. It does not certify scientific calibration or complete data parity.
- Keep the service awake for its scheduled collection process after cutover.
- Do not run `db:push`, initialize an empty schema, or import development
  records as part of deployment.

## Activation and domain cutover

1. Add the secure variables, then review/apply the staged Railway changes.
2. Generate a Railway test domain. Check health, the reference endpoint,
   existing projections, approved inputs, company data and news. Do not perform
   test edits against the shared live database.
3. Confirm GitHub branch `main` is connected, unpinned, and automatic
   deployments are enabled. Verify a later approved push deploys its exact SHA.
4. Only after parity checks, add `climatetracking.live` in Railway and use the
   DNS records Railway supplies. Preserve the Replit deployment for rollback
   while DNS and TLS settle.
5. Ensure only one scheduler is active: leave Railway disabled until the
   Replit instance's scheduler is stopped; then enable Railway's scheduler.
   Cadence and approval rules stay unchanged.
6. Verify the custom domain routes to Railway with valid TLS and the intended
   version before declaring the migration complete. Do not remove the existing
   database when retiring the old web deployment.

## Calculation status

Publishing these changes does not finish Package 2 or promote its diagnostic
native-gas candidate. The published CAT references stay distinct from the
dashboard's own calculation.
