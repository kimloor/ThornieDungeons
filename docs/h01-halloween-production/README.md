# H01-04 — Halloween Graphics Production Review

Status: **REVIEW PACKAGE PREPARED; NOT READY FOR H01-07**. Date: 2026-10-30, Asia/Bangkok.

## Authority and source lock

Owner explicitly authorized the approved images in this conversation as production references after the initial missing-repository preflight. `SOURCE_LOCK.json` pins the three accepted concepts, Excaliburnt revision 2 and prototype icon/Idle. No new visual identity was invented. H01-04 authorizes final artwork and a dedicated Graphics branch/Draft PR only. No R2 upload, production manifest binding, runtime/gameplay/backend modification, main merge or deploy.

Latest main rechecked: `e556e177d046d00126fa9fae95d81cd3ea37fc4c`; difference from the original `dcb4cd0` baseline is unrelated synchronized `src/data/r2-manifest.json` content. Relevant contracts and art sources are unchanged. AGENTS.md, H01, Roadmap V3, Equipment Pipeline and Master Template were read; existing Gate 0 sources reused. All equipment references come from the manifest-selected files, stripping query revisions only for local path access. Current originals remain unchanged.

## Package decisions

| Package | Status | Scope of finding |
| --- | --- | --- |
| A — Gate | **PASS — file/export checks; final PL visual acceptance pending** | 1024×1536 lossless WebP Alpha from the approved purple prototype; source framing unchanged. Original Boss Gate untouched. |
| B — Boss | **PASS — offline file/coverage and visual-preparation checks; final PL visual acceptance pending** | Seven 768×768 RGBA frames, left-facing identity, complete attack and defeated pose, fixed-canvas normalization, no visible frame-edge clipping. Standing hoof-contact variation is recorded rather than hidden by recentering. Phaser/runtime QA not run. |
| C — Excaliburnt | **REVISION REQUIRED — runtime compatibility not satisfied** | Icon and eight declared weapon PNGs prepared; six visible poses preserve grip references and remain inside canvas. Actual current layer-order composites reveal hand occlusion defects for bare hands and legacy/mixed gloves. Two Death PNGs intentionally follow the existing transparent boss-weapon Death convention; PL must explicitly confirm this interpretation if visible Death artwork is required. |

These are preparation/file checks, not a global QA PASS or permission to publish. Final independent artwork review remains required for A and B. H01-04 completion gate is **not closed** while Package C compatibility remains unresolved.

## Final asset inventory

Files are staged under `docs/h01-halloween-production/assets/`, followed by their future logical keys. This deliberately avoids the live `r2-upload/` publication lane.

- `ui/dungeon-select/dungeon-gate-halloween-v1.webp` — 1024×1536 WebP Alpha.
- `monsters/haloween_nightmare/{idle_01,idle_02,idle_03,attack_01,attack_02,attack_03,death_01}.png` — seven 768×768 RGBA PNGs.
- `ui/equipment-icons/event/excaliburnt.png` — 512×512 RGBA; exact approved revision-2 prototype icon bytes.
- `hero/v5/g2/weapons/excaliburnt/{idle_01,idle_02,idle_03,attack_01,attack_02,attack_03,death_01,death_02}.png` — eight 768×768 RGBA PNGs, layer `sword`, two intentional empty Death files.

`INVENTORY.json` lists each concrete path and future key individually with SHA-256, alpha and dimensions. `SHA256SUMS` covers all review files. No file is silently missing. `MISSING_FAILED_ASSETS.json` distinguishes complete file presence from unresolved visual/runtime requirements.

Future manifest targets are **documentation only**: `assets.monsters.haloween_nightmare` and `assets.itemIcons.eventWeapons.excaliburnt`. `FRAME_CONTRACT.json` is not a live manifest and is not imported by the game.

## A — Gate evidence and positioning

`qa/GATE_BEFORE_AFTER.png` compares original Gold and final Purple exports. WebP dimensions/decoded alpha are checked against the approved purple PNG. Preserve the full source frame; do not trim or apply per-view artwork crops.

`qa/GATE_MAP_360.png`, `GATE_MAP_390.png` and `GATE_MAP_1280.png` are the approved H01-03 static portrait-map placement studies. Proposed X31% / Y13% / scale .72 puts the gate left of Floor 10 and above-left of Floor 8 without rectangle intersection with those gates or sample shell controls. They are **not runtime captures**; production `background-size:cover` can crop differently. DEV must map the approved arch into actual world coordinates and validate portrait/desktop cropping before integration. No runtime positioning was implemented.

## B — Boss animation evidence

Exact display name: **Haloween nightmare**, canonical ID `haloween_nightmare`, future Phaser origin `(0.5,1)`, `sizeClass:large`, `anchorType:ground`.

`qa/BOSS_CONTACT_SHEET.png` shows all seven frames. `BOSS_IDLE_PREVIEW.gif`, `BOSS_ATTACK_PREVIEW.gif` and `BOSS_DEATH_PREVIEW.gif` preserve a fixed stage. Previews use 440ms Idle and 300ms Attack as an offline review timing proposal, not an approved runtime cadence. Final defeated pose retains the same horse/rider/scythe identity and leaves transparent space above the collapsed figure.

Idle_01 copies the approved prototype unchanged. Other generated source canvases are uniformly normalized from 1254×1254 to 768×768 at origin [0,0], without alpha trim or content-bbox recentering. Before normalization, subvisible source alpha values 1–3 are cleared to remove isolated imagegen edge dust; all higher alpha and RGB artwork remain. `BOSS_AUTHORING.json` records normalization. Standing hoof bottoms vary at most a few pixels; `VALIDATION.json` records four contact-region measurements per frame. This is offline evidence, not a measured skeletal rig, actual Phaser ground-anchor validation or exact per-pixel anatomical identity.

## C — Weapon grip and compatibility evidence

The accepted revision-2 master retains a rounded rock completely concealing the embedded blade tip. The icon reuses its approved bytes. The six visible overlays are offline transforms of that exact master: source grip (512,1250), uniform scale .205, Idle grips (270,505)/(270,493)/(270,501), Attack grips (310,309)/(489,448)/(413,551) and established clockwise orientations 135°/-53°/35°/112°. No per-file trimming/recentering, runtime transform or baked Y=84 was added. Transform evidence is explicit in `FRAME_CONTRACT.json`.

No Hero pixels occur in the weapon files: they are derived solely from the independent weapon master. Complete grip artwork is retained; no hand-shaped hole is used to hide a layering defect. Stone and weapon alpha remain inside each visible frame.

`qa/WEAPON_CONTACT_SHEET.png` and seven `HERO_*_8_FRAMES.png` sheets show every declared pose. The underlying `qa/hero/` composites cover bare, Azure, Azure without gloves, Leather, Leather without gloves, mixed legacy gloves and mixed Leather gloves: **56 actual-export composites**. `qa/GRIP_COMPARISON.png` enlarges the Idle grip issue.

The current `HeroV5RuntimeContract.js` was executed unmodified in an isolated VM with a temporary in-memory Excaliburnt texture mapping. Its returned layer order/crops were rendered offline with Sharp. This preserves the real selection-specific layer order; it is **not Phaser/browser runtime evidence**. Offset 84 is omitted equally from every layer to show source-canvas authoring coordinates. `qa/LAYER_CONTRACT_EVIDENCE.json` records all 56 lists.

Findings:

1. Bare and no-glove selections have no post-sword hand pass for this new identity: complete handle crosses skin. Legacy Azure/mixed gloves likewise do not inherit the Leather-only occlusion policy. Leather-glove cases receive the existing scoped pass/foreground-arm behavior and show a plausible hand-over-grip result. Fixing this needs a separately reviewed scoped DEV interface or explicitly approved compatible artwork strategy; no global order change is authorized or made here.
2. `EquipmentVisualResolver.js` currently recognizes three existing boss weapon identities and does not recognize Excaliburnt. Normal item-to-visual binding is deliberately absent; the isolated texture fixture bypasses only that missing binding for inspection and does not claim integration.
3. Existing boss weapon/Azure Death poses declare no grip and empty weapon layers. Two transparent Death exports preserve that convention. If H01-04's “stone remains visible” is intended to apply during Death too, a new Death grip/placement rule is required. The omission is explicit; the package does not claim eight visible weapon poses.

## Next action

Project Lead reviews A/B artwork and Package C evidence. Resolve the hand-occlusion/item-binding interface and explicitly confirm Death weapon visibility before declaring H01-04 complete or authorizing H01-07. No runtime, D1, WebGL, authenticated Production, device, CI release or gameplay regression PASS is claimed. Application sources did not change; no game build/version bump was performed.
