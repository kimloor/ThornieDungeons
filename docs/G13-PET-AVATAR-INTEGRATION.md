# G13 Pet Avatar integration — Ver 1.1.17

Status: **DONE / PRODUCTION VERIFIED — 8/8 portraits published and integrated**.
Issue #146; PR #148. Risk MEDIUM: assets and client presentation only.
Owner approved the eight PNGs from `6f69d1690b743837dbb381934c23f4af99788eb3`
and explicitly authorized Graphics to stage, integrate, test, merge/deploy and verify.

## Baseline and preservation

Latest integration baseline: `57f64858cd98a35b44ed2113eda8c2a3f788acd4`, Ver 1.1.16.
Includes #149 Inventory/Crafting overlay positioning hotfix, #147 shared overlay shell,
and the newer Lead roadmap/Admin documentation. Their changes are preserved.
Original artwork review baseline: Ver 1.1.14 `d96cb5c`; review PR was based on `e203856`.

No art was regenerated or repainted. Eight approved 256×256 RGBA PNGs are copied
byte-for-byte into `r2-upload/ui/pet-avatars/`. Exact bytes/hashes remain in
`graphics/g13/QA.json` (44,251–72,132 bytes each; 473,678 bytes total).
PNG decode, alpha 0–255, safe padding ≥20 px, dimensions and approved SHA-256 pass 8/8.
The runtime manifest change is additive: only `assets.petAvatars` is added.
Existing groups/paths, battle sprites, Worker/API/D1, authoritative player data and
gameplay rules are unchanged. The generated bucket inventory is not hand-edited.

| Manifest key | R2 key |
| --- | --- |
| petAvatars.sprout | ui/pet-avatars/sprout.png |
| petAvatars.flamekit | ui/pet-avatars/flamekit.png |
| petAvatars.sparkpup | ui/pet-avatars/sparkpup.png |
| petAvatars.ember_fox | ui/pet-avatars/ember_fox.png |
| petAvatars.moon_hare | ui/pet-avatars/moon_hare.png |
| petAvatars.hell_wolf | ui/pet-avatars/hell_wolf.png |
| petAvatars.inferno_drake | ui/pet-avatars/inferno_drake.png |
| petAvatars.storm_phoenix | ui/pet-avatars/storm_phoenix.png |

Worker-facing URLs are `/assets/` plus the R2 key. No path was renamed or deleted.

## Shared runtime behavior

`src/assets/manifest.js`: `petAvatarUrl(defId)` resolves the shared optional manifest
group. It does not use instance IDs or the `sprout001` battle alias. `PetAvatar`
uses the authoritative catalog definition, remembers a failed image URL and renders
its catalog emoji instead, with no image node or repeating onError retry. Unknown/no
Pet uses 🐾. A different Pet URL can still render after one fails.
Images use `object-fit: contain`, no circular clipping, and the full square safe area.
Decorative avatars suppress duplicate accessibility labels next to visible Pet text.

| Consumer | Integration |
| --- | --- |
| Pet Roster | 40 px portrait; selection still passes the exact instance ID |
| Pet Detail | 32 px portrait badge inside the showcase; animated artwork and existing name/level/stats remain |
| Gacha result | 64 px portrait, existing result/interaction unchanged |
| Arena Setup | 36 px portraits in custom details/summary and rows; selected name + level |
| Arena Player Card | 32 px portrait in existing Pet row; no card redesign |
| Future Player Card | shared resolver/component reusable without a new path map |

Arena battle stage and replay use Phaser actors and generic ATB role icons rather
than a separate Pet portrait surface. They remain unchanged. No changes to combat
timing, state, results, selection authority, Arena API or save format.

## Verification

- Full Node suite: **811/811 PASS**, 0 fail/skip, including 6 G13 tests.
- Node G13 tests verify approved bytes/dimensions/PNG inflate, manifest catalog coverage,
  strict definition-ID resolution, missing keys, broken images/no retry, emoji/paw
  fallback, roster instance selection, and shared consumer/battle boundaries.
- Independent Pillow decode verifies actual RGBA alpha extrema/bounds and padding 8/8.
- Build: `node build.js`, 71 modules; generated `index.html` current. Diff whitespace clean.
- Real headless Chromium fixture using the built runtime: 360/390/1280 px viewports.
  Pet Roster selection, Detail portrait, Arena Setup selection + summary level and
  existing Arena Player Card portrait PASS. No horizontal page overflow.
- All eight images decode at 32/40/48/64/96 CSS px at all three viewports (40 gallery
  images per viewport). Broken-image injection makes exactly one request then emoji;
  removing the manifest group renders catalog emoji. No retry loop.
- Visual screenshot review found narrow roster icon/text overlap in an early version;
  fixed by stacked mobile entries, and a bounding-box regression check now verifies
  no image/label overlap at all three widths. No new layout issues in reviewed surfaces.

Browser QA uses isolated local fixtures and mocked Arena GET data, not a Production
player session. The fixture uses a local font substitute; system emoji/Thai fonts and
unrelated unavailable local navigation assets are not Production typography evidence.
Evidence: `graphics/g13/runtime-qa/RESULTS.json` and selected screenshots alongside it.
No authenticated Production gameplay/selection test is claimed by this local run.

## Release gates

Merge, upload/hash verification, frontend deployment, live asset checks and branch
cleanup are complete; exact evidence follows. G14/G15 remain specification-only.

## Production evidence — 2026-10-26 (Asia/Bangkok)

- PR #148 merged to `main`: `3ce83a0d6077e75a514e5cd989399e0c7f6588a7` (Ver 1.1.17).
  Integration head: `9e4c0b69134ac5bf1077e791200881d1d2fb60ec`.
- Upload R2 assets run **40280305831**, job **121431917817**: SUCCESS. Logs
  explicitly record `Verified manifest.json` and all eight `ui/pet-avatars/*.png`,
  then `Uploaded and verified 9 object(s).` The workflow downloaded each object
  and compared local/remote SHA-256. All staged bytes match approved QA hashes.
- Deploy ThornieDungeons Frontend run **40280305689**, job **121431917332**: SUCCESS,
  including Inventory regression, build, generated output and Production verification.
- Live Cloud Browser: `/assets/manifest.json` parses with schema thornie-assets-v2
  and all 8 exact `assets.petAvatars` entries; all eight Worker-facing image URLs
  return real decoded images, `complete=true`, natural dimensions 256×256.
- Production root visibly reaches Login and both meta/badge show **1.1.17**.
  No game runtime error observed in the anonymous login path (browser-extension
  metadata error is unrelated and excluded). No authenticated Production Pet
  selection/gameplay test was performed; those consumer behaviors were exercised
  in the isolated Chromium fixture described above.
- Cleanup merged branches run **40280356969**, job **121432070333**: SUCCESS.
  Remote branch listing confirms `graphics/146-pet-avatar-review` is gone; only
  `main` and permanent `ops/branch-cleanup` remain.

The release checklist is satisfied by this evidence; this record
is the current acceptance state. Counts: 8 approved / 8 staged / 8 uploaded /
8 live decoded; 0 missing, 0 regenerated, 0 replaced production paths.
G14 is the next Graphics task using the prepared one-emblem loading specification;
G15 remains queued after G14. No G14/G15 artwork was produced in this integration.

Copy-ready Project Lead handoff:
> #146 DONE — PR #148 merged, Ver 1.1.17, release main 3ce83a0. G13 8/8
> approved portraits integrated through one resolver/component; no gameplay/API/D1
> changes. Full tests 811/811; browser fixture 360/390/1280 + failure injection PASS.
> R2 upload/hash verification 40280305831 and frontend deploy 40280305689 PASS;
> Production manifest + all 8 image decodes + Login version verified. Branch cleaned.
> Authenticated Production Pet selection not tested. Next: start G14 from prepared
> specification; G15 remains queued.
