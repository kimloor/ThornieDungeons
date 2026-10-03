# G10.5 — Global production icon audit

Baseline: `r2-upload/README.md` → Production icon asset budget. No separate G10.5 thresholds.
Scope: PNG icon-type assets under `r2-upload/ui/**`; decorative panels, buttons,
large hub emblem, backgrounds, VFX, Hero frames and sprites are excluded.
The CSV companion contains every audited path, manifest key, dimensions, bytes,
alpha/padding, PASS/REVIEW/FAIL, reason, recommendation and final action.

- Audited: 74; PASS 64; REVIEW 3; FAIL 7.
- Audited total: 18,514,997 → 11,307,111 bytes (7,207,886 bytes saved).
- Optimized candidates: 6; same PNG path and manifest key.

## Optimization candidates

| Asset | Before | After |
| --- | ---: | ---: |
| `r2-upload/ui/equipment-icons/boss/icicle_longsword.png` | 646,583 B | 123,759 B |
| `r2-upload/ui/equipment-icons/boss/lavalon_sword.png` | 872,110 B | 163,790 B |
| `r2-upload/ui/equipment-icons/boss/spirit_greatsword.png` | 946,284 B | 170,952 B |
| `r2-upload/ui/item-icons/materials/earth_stone.png` | 1,911,982 B | 102,585 B |
| `r2-upload/ui/item-icons/materials/fire_stone.png` | 1,742,180 B | 86,834 B |
| `r2-upload/ui/item-icons/materials/water_stone.png` | 1,829,306 B | 92,639 B |

## Unresolved damaged source assets — publication blocker

- `r2-upload/ui/equipment-icons/azure/azure_armor.png` — PNG decode failure: OSError; 786,446 B, 1254×1254 (header only).
- `r2-upload/ui/equipment-icons/azure/azure_boots.png` — PNG decode failure: OSError; 786,444 B, 1254×1254 (header only).
- `r2-upload/ui/equipment-icons/azure/azure_gauntlets.png` — PNG decode failure: OSError; 786,444 B, 1254×1254 (header only).
- `r2-upload/ui/equipment-icons/azure/azure_helmet.png` — PNG decode failure: OSError; 786,444 B, 1254×1254 (header only).
- `r2-upload/ui/equipment-icons/azure/azure_ring.png` — PNG decode failure: OSError; 786,444 B, 1254×1254 (header only).
- `r2-upload/ui/equipment-icons/azure/azure_sword.png` — PNG decode failure: OSError; 786,444 B, 1254×1254 (header only).
- `r2-upload/ui/equipment-icons/wings/angel_wings.png` — PNG decode failure: OSError; 786,444 B, 1254×1254 (header only).

These files were already invalid in the audited `main` baseline, not damaged by this batch.
All six Azure set-item PNGs and legacy `angel_wings.png` must be recovered from
intact approved masters, visually matched, then optimized before G10.5 can close.
Do not treat corruption as a size-only exception or recreate approved artwork by guesswork.

## Review-only assets and exceptions

- `r2-upload/ui/profile-frames/arena_rank_1.png` — 278,770 B, Above 250,000 B target; below 300,000 B hard limit.
- `r2-upload/ui/profile-frames/arena_rank_2.png` — 271,796 B, Above 250,000 B target; below 300,000 B hard limit.
- `r2-upload/ui/profile-frames/arena_rank_3.png` — 252,645 B, Above 250,000 B target; below 300,000 B hard limit.

No oversized icon is silently grandfathered. REVIEW is pending visual/usage sign-off,
not an approved exception. There is no approved >500 KB exception.

## QA and publication gate

- Full PNG decode, alpha bounds, manifest mapping and at-size readability must pass.
- Verify actual Inventory, equipment/Compare, Shop, Craft, Reward, Arena, Raid and Battle
  mobile surfaces after publication; explicitly retest Azure and Earth/Fire/Water Stone.
- Download every replaced R2 object and compare SHA-256 with committed production PNG.
- Check 404/missing images, fallback behavior and mobile loading. Do not claim complete
  while Azure source recovery or production QA remains open.
- G11 Robot/Skeleton item icons must comply with this same shared budget and have zero
  FAIL icons before publication.
