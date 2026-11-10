# ThornieDungeons Deployment

Status: current deployment source of truth for Cloudflare-related release flow.

## Source of truth

- GitHub repository: `kimloor/ThornieDungeons`
- Production changes should originate from GitHub, not from manual edits in the Cloudflare Dashboard.
- Frontend and API deployment paths are separate.

## Cloudflare credentials already wired

GitHub Actions already uses:

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

These are reused by the API/D1 deployment workflow. Do not commit secret values into the repository.

Optional:

- `CF_D1_DATABASE_ID`
  - If the Cloudflare account contains exactly one D1 database, the workflow auto-detects it.
  - If multiple D1 databases exist, set this secret so the workflow can select the production database safely.

## Worker API deployment

Production API source:

`workers/thornie-dungeons-api.js`

Production Worker name:

`thornie-dungeons-api`

Workflow:

`.github/workflows/deploy-api.yml`

When `workers/thornie-dungeons-api.js` is changed on `main`, GitHub Actions deploys the API Worker automatically with Wrangler.

The workflow uses `--keep-vars` so existing Cloudflare Dashboard variables/secrets are preserved during deployment.

The Worker expects its D1 binding as:

`env.DB`

## D1 migration deployment

Historical migrations under `migrations/` were handled before CI/CD automation and must not be replayed automatically.

All new production D1 migrations intended for automatic release must be placed in:

`migrations/auto/`

Release order is:

1. Resolve the production D1 database.
2. Apply pending SQL migrations in `migrations/auto/` with Wrangler against the remote D1 database.
3. Only after migrations succeed, deploy `workers/thornie-dungeons-api.js`.
4. Verify that the Worker deployment exists.
5. Run the optional live smoke test when `CF_API_SMOKE_URL` is configured.

If migration fails, the Worker deploy step does not run.

## Normal release flow for DEV / AI agents

Use this flow for backend changes:

`DEV/AI -> branch -> tests -> user/release approval -> merge to main -> D1 migration -> Worker API deploy -> verification`

For changes that require a schema update, commit the API code and its forward migration together. The migration must be in `migrations/auto/` before merging to `main`.

Do not ask the user to manually paste `workers/thornie-dungeons-api.js` into Cloudflare when the automated deployment path is available.

## Login/Auth V2 note

Login/Auth V2 migration v11 is already applied in production. It must not be replayed, recreated, or added to `migrations/auto/`.

`migrations/auto/` remains the deployment lane for future new, forward-only production migrations. Any later Auth schema change must use a new migration rather than modifying or reproducing migration v11, and it must continue through the existing migration-before-Worker deployment flow above.

## R2 asset deployment

R2 asset deployment is already automated separately through GitHub Actions.

Relevant workflow:

`.github/workflows/upload-r2-assets.yml`

Staging convention:

`r2-upload/<key>` -> R2 bucket object `<key>`

The existing R2 workflow also uses `CF_API_TOKEN` and `CF_ACCOUNT_ID`.

## Safety rules

- Never replay legacy migrations automatically just because they exist under `migrations/`.
- Never guess a production D1 database when multiple databases exist.
- Never commit Cloudflare tokens, account IDs that are intended to remain secret, or secret values into source files.
- Do not manually edit the live Worker as the normal release path; doing so can create drift from GitHub.
- Destructive or irreversible D1 changes still require explicit user approval before release.
