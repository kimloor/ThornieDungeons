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

## Production icon asset budget

This is the shared production contract for small UI/item/equipment icons under `r2-upload/`. It applies to all new Graphics batches and to optimization/replacement of existing icons.

### File-size targets

| Icon class | Target | Hard limit | Review rule |
| --- | ---: | ---: | --- |
| Small UI / material / recipe / currency / utility icon | 40–120 KB | 200 KB | >120 KB should be checked for avoidable canvas/encoding waste |
| Equipment / set-item / boss-weapon icon | 80–200 KB | 250 KB | >200 KB requires an explicit quality reason |
| Exceptional high-detail / heavy-effect icon | ≤250 KB preferred | 300 KB | 250–300 KB requires review before publish |
| Any icon | — | 500 KB absolute exception threshold | >500 KB is treated as abnormal and must not ship without explicit Project Lead approval |

These are production-delivery budgets, not master-art limits.

### Canvas / resolution rules

- Use the smallest production canvas that preserves approved small-screen readability.
- Do not ship 1024/2048 px masters directly for icons displayed around 20–100 px.
- Reuse an established family canvas where a production contract already exists.
- A new icon family must record its final production canvas/dimensions in its graphics contract/checklist.
- Transparent icons must keep clean alpha edges and safe padding.

### Master vs Production

- **Master asset:** may remain large, lossless, layered, high-resolution, and several MB if useful for future editing.
- **Production asset:** must be cropped/resized/optimized for runtime use before it enters `r2-upload/`.
- Do not reduce visual quality blindly to meet a number. If an icon cannot meet the normal budget without visible degradation, report it for review instead of silently shipping an oversized file.

### Format / optimization

- PNG is acceptable when transparency or pixel-accurate lossless output is required.
- WebP may be used where the existing runtime/browser pipeline supports it and visual/alpha quality is preserved.
- Remove unnecessary metadata and oversized transparent canvas area.
- Do not change approved artwork composition merely to reduce file size.

### Required pre-publish checks

Every new or replaced production icon must verify:
1. final pixel dimensions / canvas;
2. encoded file size;
3. transparent alpha edges where applicable;
4. readability at actual mobile display size;
5. manifest key and R2 path;
6. no unnecessary duplicate or supersized source file is being used as the runtime asset.

### Existing oversized assets

Older production assets are not automatically invalidated by this contract. When a loading/performance problem is observed, optimize the affected family as a focused replacement while preserving:
- the approved artwork;
- the existing production path/manifest key where practical;
- runtime behavior and gameplay authority.

Known families currently worth optimization review include the Azure equipment item icons and unusually large Reward V2 material icons. Optimization work must preserve appearance and be verified on mobile after replacement.

