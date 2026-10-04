# G10.5 — Global production icon audit

Baseline: `r2-upload/README.md` → Production icon asset budget. No separate G10.5 thresholds.
Scope: PNG icon-type assets under `r2-upload/ui/**`; decorative panels, buttons,
large hub emblem, backgrounds, VFX, Hero frames and sprites are excluded.
The CSV companion contains every audited path, manifest key, dimensions, bytes,
alpha/padding, PASS/REVIEW/FAIL, reason, recommendation and final action.
G10.5+G11 set-item, Angel Wings and Arena frame replacements use
`?v=g10_5_g11_r1` to bypass stale browser/edge caches; production keys and paths
are preserved for Azure, Angel Wings and Arena frames.

- Audited: 86; PASS 86; REVIEW 0; FAIL 0.
- Audited total: 11,307,111 → 6,711,039 bytes (4,596,072 bytes saved).
- Batch changed: 22 files (18 set icons, Angel Wings, 3 Arena frames).
- Publication commit: `PENDING`.
- Exceptions: none. Final REVIEW and FAIL counts are both zero.

## G10.5 + G11 rebuilt/optimized files

| Asset | Before | After |
| --- | ---: | ---: |
| `r2-upload/ui/equipment-icons/azure/azure_armor.png` | 786,446 B | 106,904 B |
| `r2-upload/ui/equipment-icons/azure/azure_boots.png` | 786,444 B | 72,586 B |
| `r2-upload/ui/equipment-icons/azure/azure_gauntlets.png` | 786,444 B | 76,029 B |
| `r2-upload/ui/equipment-icons/azure/azure_helmet.png` | 786,444 B | 91,401 B |
| `r2-upload/ui/equipment-icons/azure/azure_ring.png` | 786,444 B | 80,258 B |
| `r2-upload/ui/equipment-icons/azure/azure_sword.png` | 786,444 B | 27,776 B |
| `r2-upload/ui/equipment-icons/robot/robot_armor.png` | 0 B | 100,089 B |
| `r2-upload/ui/equipment-icons/robot/robot_boots.png` | 0 B | 75,112 B |
| `r2-upload/ui/equipment-icons/robot/robot_gauntlets.png` | 0 B | 84,707 B |
| `r2-upload/ui/equipment-icons/robot/robot_helmet.png` | 0 B | 86,511 B |
| `r2-upload/ui/equipment-icons/robot/robot_ring.png` | 0 B | 63,922 B |
| `r2-upload/ui/equipment-icons/robot/robot_sword.png` | 0 B | 57,856 B |
| `r2-upload/ui/equipment-icons/skeleton/skeleton_armor.png` | 0 B | 96,316 B |
| `r2-upload/ui/equipment-icons/skeleton/skeleton_boots.png` | 0 B | 72,958 B |
| `r2-upload/ui/equipment-icons/skeleton/skeleton_gauntlets.png` | 0 B | 88,948 B |
| `r2-upload/ui/equipment-icons/skeleton/skeleton_helmet.png` | 0 B | 95,335 B |
| `r2-upload/ui/equipment-icons/skeleton/skeleton_ring.png` | 0 B | 68,087 B |
| `r2-upload/ui/equipment-icons/skeleton/skeleton_sword.png` | 0 B | 63,537 B |
| `r2-upload/ui/equipment-icons/wings/angel_wings.png` | 786,444 B | 45,935 B |
| `r2-upload/ui/profile-frames/arena_rank_1.png` | 278,770 B | 89,674 B |
| `r2-upload/ui/profile-frames/arena_rank_2.png` | 271,796 B | 86,197 B |
| `r2-upload/ui/profile-frames/arena_rank_3.png` | 252,645 B | 82,111 B |

Azure 6/6, Robot 6/6 and Skeleton 6/6 are 256×256 RGBA PNGs within the
equipment-icon target. `angel_wings.png` remains active and now reuses the approved
Azure Angel production wing art at its stable path/key. All three Arena profile frames
remain 512×512 and use an optimized indexed production palette; visual
comparison found no material display-size difference.

## G11 baseline

New small runtime icons must use the shared budget in `r2-upload/README.md`, decode
fully, preserve alpha, avoid excess canvas, remain readable at mobile display size, and
ship with zero FAIL icons. This document and its CSV are the reusable baseline.
