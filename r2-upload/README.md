# R2 upload staging

Files committed under this directory are uploaded automatically to the Cloudflare R2 bucket `assets` when they reach `main`.

Path mapping is direct:

```text
r2-upload/raid/azure_angel_idle_1.png
-> R2 key: raid/azure_angel_idle_1.png

r2-upload/ui/town-background.webp
-> R2 key: ui/town-background.webp
```

Supported file types:

- PNG, WebP, JPG/JPEG, GIF, SVG
- JSON
- MP3, OGG, WAV

Rules:

- Only added, modified, or renamed files are uploaded on a normal push.
- Deleting a file from this directory does **not** delete the R2 object.
- Each uploaded object is downloaded again and SHA-256 verified by the workflow.
- Files larger than 100 MiB are rejected.
- Symlinks are rejected.
- `workflow_dispatch` uploads all supported files currently present under `r2-upload/`.

Required GitHub secrets:

- `CF_ACCOUNT_ID`
- `CF_API_TOKEN` with R2 write access to the `assets` bucket.

For least privilege, use a token that can read/write objects in the `assets` bucket only.

UI artwork should be staged under `r2-upload/ui/`; production builds rewrite `ui/<image>` references to `/assets/ui/<image>` so the Worker serves the R2 object.
