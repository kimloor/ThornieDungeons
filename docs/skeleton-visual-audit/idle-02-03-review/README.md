# Skeleton Idle_02–03 — Graphics completion review

**ARTWORK READY — PROJECT LEAD REVIEW PENDING**
**Final status: AWAITING OWNER VISUAL APPROVAL**
Baseline: main `ab3a887ee2036ab37c6f5244c8658058e5291be0`. Risk: LOW; review-only artwork derivation, no activation/publication.

## Result and source lock

Eight candidate PNGs: helmet, torso_armor, arm_rear and legs_boots for each of Idle_02 and Idle_03. Source is the exact Owner-approved Idle_01 revision07 PNGs currently in canonical staging; SHA-256 checked against approved-idle-01/PUBLICATION.json. Idle_01 is untouched.

Root cause of inconsistent idle appearance: previous publication replaced only Idle_01. Idle_02–03 still resolve the earlier artwork. This review supplies the missing two-frame corrections without changing the running game.

Actual current Base, Underlay, Arm Front and Sword are independently verified as exact Idle_01 pixel translations: Idle_02=(0,-12), Idle_03=(0,-4). The same integer shifts are baked into the four corrected candidate layers. No new generated artwork, resampling, recentering, rotation, guessed anatomical anchors or runtime compensation. This is per-frame authoring from measured existing motion, not copying one static PNG to all frames.

## Review assets

- OLD-VS-NEW.png: current vs candidate, columns Idle_01/02/03; Idle_01 serves as unchanged control.
- IDLE-01-03-ASSEMBLED.png: complete candidate idle sequence, with locked Idle_01.
- ALIGNMENT-DETAIL.png: current/candidate chest, hands, waist and legs for both corrected frames.
- IDLE-COMPARISON.gif: current/candidate side-by-side, 01→02→03 loop, 440ms per frame. Fixed full-canvas viewport retains sword tip; no frame-specific crop/recentering.
- candidates/idle_02 and candidates/idle_03: eight 768x768 RGBA review exports. These are NOT runtime paths.
- INVENTORY.json and SHA256SUMS: source/current/candidate hashes, future destination paths, pixel-preservation checks and changed inventory.
- RUNTIME-REFERENCE.json: actual resolver-selected idle layer order/paths, transforms, timing and fallback results.
- build_review.py: reproducible review-only build and assertions; writes only this evidence directory. Requires Pillow/NumPy and DejaVu Sans for labels.

## QA

| Verification | Result |
|---|---|
| PNG RGBA 768x768, eight candidates | PASS |
| Alignment follows measured Base idle displacement | PASS |
| Armor/pants proportions preserved without resampling | PASS |
| Assembled 01–03 full RGBA equality after bob compensation | PASS |
| Approved revision07 source hash and pixel consistency | PASS |
| Alpha pixel count preserved / no on-canvas content clipping | PASS |
| Base / Idle_01 / Attack / Death unchanged | PASS |
| Runtime order, hair suppression, frame timing and no fallback | PASS |
| Owner visual acceptance of Idle_02–03 | PENDING |
| R2 publication / read-back / public decode of new frames | NOT PERFORMED — NOT AUTHORIZED |

The full assembled candidate frames are exact RGBA translations of the approved full Idle_01, not merely approximate silhouettes. Static review shows matched chest/waist, helmet/head and boot/leg proportions across the new frames; existing hand/sword occlusion order is unchanged. This preserves the approved Idle_01 visual limitations too; it does not invent new fit approval. Existing neutral Base fringes or accepted material boundaries are not redesigned.

Canonical Skeleton integrity/resolver tests: 3/3 PASS. These validate the unchanged production inventory/resolver, separately from the candidate image assertions above. No full regression/build was run because no source code or generated output changed. No live Phaser/Production visual QA claimed.

## Release gate

Only this docs review directory is added. No r2-upload, source, Manifest, Runtime, Base, Idle_01, Attack/Death, gameplay or economy changes. Draft review PR is not publication authorization. Nothing to merge into runtime before explicit Owner approval. Candidate filenames are deliberately outside r2-upload, preventing the normal upload workflow from publishing them even if evidence is later merged.

After Owner approval only: copy the eight accepted candidate files to their recorded existing staging paths, update only their SOURCE_VALIDATION hashes/publication metadata, then follow the project R2 upload/read-back and public decode/cache/runtime-resolution gates. In-game Production visual QA remains separate.

## Copy-ready Project Lead handoff

> Skeleton Idle_02–03 ARTWORK READY / AWAITING OWNER VISUAL APPROVAL. Eight review PNGs derived from hash-locked Owner-approved Idle_01 revision07 with measured integer bob02=-12px,03=-4px. Eight RGBA768 checks, exact pixel/alpha-preservation and full assembled continuity checks PASS; canonical Skeleton tests3/3 PASS. Evidence: docs/skeleton-visual-audit/idle-02-03-review/ (old/new, full sheet, detailed joins, 440ms loop, inventory/SHA). All work is docs-only; no R2/Manifest/Runtime/Idle_01/Base/Attack/Death changes or deployment. Next: Project Lead reviews evidence and sends to Owner. Publish the eight existing-path replacements only after explicit Owner approval, then R2 read-back SHA/public decode/cache/runtime checks and Owner Production QA.
