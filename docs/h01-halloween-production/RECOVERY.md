# H01-04 Recovery — 2026-10-30 Asia/Bangkok

Status: **ASSETS RECOVERED / EXCALIBURNT REVISION REQUIRED / CANVAS QA BLOCKED / H01-04 OPEN**.
Risk: MEDIUM — graphics recovery and review evidence only.

## Repository and provenance

Verified main: `2c0304d267ac0b89a76681991b0090bece2fdbc9`.
The pre-existing remote `art/h01-04-final-graphics` was at `e556e177d046d00126fa9fae95d81cd3ea37fc4c`; no PR for that head existed at recovery preflight. It did **not** contain the graphics files.
Recovered the actual prior workspace and local commits `abb451f`, `c436f3b`, and `fbc9eb36d41560f44e1130c0795f449659f2171f`. Replayed only those graphics/doc commits on current main in an isolated checkout. Original workspace and its unrelated untracked temporary file were left untouched. All recovered assets are byte-identical; no artwork was regenerated. Older README/HANDOFF describe the original preparation run; this recovery record supersedes their main SHA and QA status only.

## Verified recovered inventory

| Deliverable | Recovered | Independent recovery result |
|---|---:|---|
| Purple Boss Gate export | 1 | 1024×1536 WebP with alpha; source lock verified |
| Haloween nightmare | 7 | 768×768 RGBA; all Idle/Attack/Death paths decoded |
| Excaliburnt icon | 1 | 512×512 RGBA; approved revision-2 source bytes preserved |
| Excaliburnt weapon-only layers | 8 | 768×768 RGBA; six visible, two intentional empty Death layers |
| Hero composites | 56 | 8 poses × 7 selections; offline Sharp evidence, not Phaser captures |
| Approved source locks | 5 | All SHA-256 match |
| Original review/production hash ledgers | 143 entries | All match; no missing files or failed hashes |

`RECOVERY_VALIDATION.json` records fresh image decoding, dimensions, alpha bounds/extrema, SHA-256 and byte comparison to the recovered local commit. Existing contact sheets and GIFs are preserved for Owner review. No required source file was inaccessible after recovery. No production asset file is missing. Empty Death images and the absent Excaliburnt runtime binding are explicit unresolved requirements, not hidden missing-file errors.

## Findings and revision boundary

1. **C-HAND remains reproducible in recovered composites.** Bare/no-glove cases show the grip over the fingers; Azure and legacy mixed gloves lack a dedicated matching hand pass. Leather gloves have scoped post-sword hand/foreground behavior. The existing preparation script executed the unchanged current HeroV5RuntimeContract, and both it and HeroRenderer match latest main. The complete weapon handle is retained. Do not punch a hand-shaped hole into the shared weapon image: the same image must work with different glove silhouettes.
2. **No authorized graphics-only fix is established.** Consistent hand-over-grip presentation requires a scoped DEV review of bare/glove-specific post-sword occlusion. Runtime, manifest and Hero pixels remain untouched. Excaliburnt remains **REVISION REQUIRED**, rather than claiming that file presence fixes compatibility.
3. **C-BINDING:** EquipmentVisualResolver has no normal Excaliburnt item mapping. This belongs to the later DEV integration gate; fixture-only in-memory texture injection does not prove normal equip resolution.
4. **C-DEATH:** Both Death weapon PNGs are entirely transparent by the existing boss weapon convention. The contract says Death wherever the current pipeline requires, while final eight-frame visibility acceptance is still open. Preserve existing images; PL must resolve whether a visible Death weapon is required and provide placement before new art is authored.
5. Boss seven-frame and gate checks are export/visual-review preparation only; final Owner acceptance of animation and responsive gate placement remains pending.

## Phaser Canvas QA

`qa/recovery-canvas.html` is an isolated manual fixture for all 56 selections/poses. It uses current HeroV5RuntimeContract and actual HeroRenderer, preserves runtime Y=84 by placing the root at Y=684, and injects only Excaliburnt texture references in memory. It never writes manifest/runtime files. Serve repository root over HTTP, open the fixture, await `window.__h01Ready`, and call `await window.__h01Render(i)` for indices 0–55. Each result includes Canvas renderer type, load failures, visible order and PNG capture. This bypasses the missing item resolver mapping and cannot substitute for normal item-to-visual integration QA.

**Execution BLOCKED:** no browser executable was installed. Chromium and Headless Shell downloads returned unusable/truncated ZIPs. Phaser JS was reachable, but no browser rendered this fixture. No Phaser/browser/Canvas PASS is claimed. Current review sheets remain the recovered offline composites; there are no fabricated new runtime screenshots.

## Next required action

- Owner/PL reviews preserved Gate/Boss sheets and Excaliburnt grip evidence.
- PL assigns a separately authorized DEV occlusion/interface task and resolves Death visibility. Then revise only the affected interface/art assets and run the 56-case actual Phaser Canvas matrix in a browser-capable environment.
- Keep H01-04 open and H01-07 publication gated. No R2 upload, manifest/runtime/gameplay/economy change, merge or deploy was performed in recovery.
