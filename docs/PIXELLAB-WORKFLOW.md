# PixelLab Tool Workflow

Status: **ACTIVE — reusable graphics/tooling workflow**

## 1. Purpose

`.github/workflows/pixellab-tool.yml` is the reusable PixelLab workflow for ThornieDungeons.

Use it instead of creating a new workflow for every image or animation request.

It supports two modes:

- `generate` — generate a new image from text with PixelLab.
- `animate` — animate an existing PNG/JPEG with PixelLab `animate-with-text-v3`.

The workflow is tooling only. It does **not** automatically:

- commit generated assets,
- upload assets to R2,
- edit `r2-upload/manifest.json`,
- deploy the game,
- replace approved production artwork.

Review the artifact first, then explicitly approve the normal graphics/R2 flow.

## 2. Required secret

GitHub repository secret:

`PXL_API_TOKEN`

The workflow checks `GET /v2/balance` before generation. The token is never printed to logs.

The older `.github/workflows/test-pixellab-secret.yml` remains the small authentication-only smoke test.

## 3. Where to run it

GitHub:

`Actions -> PixelLab Tool -> Run workflow`

The workflow is manual-only through `workflow_dispatch`.

## 4. Inputs

| Input | Used by | Meaning |
| --- | --- | --- |
| `mode` | both | `generate` or `animate` |
| `prompt` | both | Image description for generate mode, motion/action description for animate mode |
| `width` | generate | Output width; default 512 |
| `height` | generate | Output height; default 512 |
| `frame_count` | animate | Requested generated animation frames; default 8 |
| `transparent` | both | Request no/transparent background |
| `source_path` | animate | Repository-relative PNG/JPEG path; preferred when the source is already in the repo |
| `source_url` | animate | Public HTTPS PNG/JPEG URL; used only when `source_path` is empty |
| `output_name` | both | GitHub artifact/folder name |

For `animate`, provide exactly one practical source:

1. Prefer `source_path` if the file is already committed in the repository.
2. Otherwise provide a public HTTPS `source_url`.

If both are supplied, `source_path` wins.

## 5. Generate example

Goal: create a 512x512 transparent fantasy reward emblem.

- mode: `generate`
- prompt:
  `fantasy RPG reward emblem, ornate gold and dark steel, ThornieDungeons visual family, centered, clean game asset`
- width: `512`
- height: `512`
- transparent: `true`
- output_name: `pixellab-reward-emblem`

Expected artifact:

- `generated.png`
- `response.json`
- `manifest.json`

PixelLab endpoint:

`POST /v2/create-image-pixen`

## 6. Animate example

Goal: animate a shield with white wings opening upward.

Example source already in repo:

`r2-upload/ui/result/victory_winged_shield_start.png`

Inputs:

- mode: `animate`
- source_path:
  `r2-upload/ui/result/victory_winged_shield_start.png`
- prompt:
  `Keep the shield perfectly centered and stable. Preserve the exact shield design and white feathered wings. Slowly open the wings upward and outward. Increase the warm golden center glow, add elegant shimmering sparkles, then settle into a fully open final pose. No camera movement. No translation of the whole emblem. No redesign.`
- frame_count: `8`
- transparent: `true`
- output_name: `pixellab-victory-wing-animation`

Expected artifact:

- `frame_00.png`, `frame_01.png`, ...
- `preview_slow.gif`
- `response.json`
- `job_id.txt`
- `manifest.json`

PixelLab endpoint:

`POST /v2/animate-with-text-v3`

The workflow polls:

`GET /v2/background-jobs/{job_id}`

until the same job completes or fails.

## 7. Slow GIF preview

For animation mode the workflow automatically creates:

`preview_slow.gif`

Review timing is currently 300 ms per frame.

This GIF is for visual review only. Production animation speed should still be defined by the game runtime/UI implementation.

## 8. Recommended ThornieDungeons asset sizes

For reusable Result/UI animation masters:

- preferred master: `512x512`
- transparent PNG frames
- display smaller at runtime rather than generating small and enlarging

Typical responsive display target:

- mobile: approximately 160–220 px
- tablet: approximately 220–300 px
- desktop: approximately 280–360 px

Do not use a small 128x128 test asset as the production master if it will be enlarged significantly.

## 9. Prompt rules for stable animation

When continuity matters, explicitly tell PixelLab:

- keep the main object centered and stable,
- preserve exact identity/design,
- change only the intended moving parts,
- no camera movement,
- no whole-object translation,
- no redesign,
- transparent background when appropriate.

For the current Victory shield direction, the animation contract is:

- shield matches ThornieDungeons visual family,
- white feathered wings behind the shield,
- wings start more closed,
- wings move upward/outward into the open pose,
- light intensity increases during the opening,
- shimmering/sparkling particles increase near the peak,
- final frame settles while the wings remain open.

This document records the animation direction so future AI/Graphics work does not have to guess it again.

## 10. Review before R2

PixelLab output is a draft until reviewed.

Before production asset integration:

1. inspect all frames, not only the GIF,
2. check object identity and proportion consistency,
3. check anchor/center drift,
4. verify transparency,
5. confirm mobile readability,
6. approve the art,
7. only then stage it under `r2-upload/**`,
8. update the real manifest key/path according to `r2-upload/README.md`,
9. allow the normal R2 asset workflow to upload it.

Do not silently overwrite an approved production asset.

## 11. Current API integration

Base:

`https://api.pixellab.ai/v2`

Used by the reusable workflow:

- `GET /balance`
- `POST /create-image-pixen`
- `POST /animate-with-text-v3`
- `GET /background-jobs/{job_id}`

PixelLab's current API documentation identifies `animate-with-text-v3` as the recommended default for still-frame-to-animation work.

## 12. Failure handling

The workflow stops without modifying production if:

- `PXL_API_TOKEN` is unavailable/invalid,
- an animation source is missing,
- a source URL is not HTTPS,
- the source is not PNG/JPEG,
- PixelLab rejects the request,
- the background job reports failed,
- polling times out,
- output frames are missing.

HTTP 5xx responses during job polling are treated as transient and the same job is polled again rather than submitting a duplicate generation request.

This avoids unnecessary duplicate PixelLab credit usage.
