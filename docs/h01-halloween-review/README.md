# H01-03 — Halloween Graphics Concept / Prototype Review

**Status: REVIEW READY — OWNER VISUAL REVIEW REQUIRED**  
Date: 2026-10-29, Asia/Bangkok. Risk: MEDIUM, visual preparation only.  
Source main: `dcb4cd0c97f145d803e4317674921d95c4a0c9c9`.

This package fulfills the current H01-03 concept/prototype assignment. It does not approve final production, runtime integration or release. The current assignment authorizes these prototypes separately from H01's implementation prohibition. Earlier pipeline status summaries are historical; current manifest selections were used for source references.

Start with **H01_03_REVIEW_OVERVIEW.png**, then review each folder separately. Owner approved Gate and Haloween nightmare concepts. Owner also approved Excaliburnt revision 2. All three concepts are approved; final production awaits a separate H01-04 assignment.

## A — Halloween Gate — OWNER CONCEPT APPROVED

- `gate/HALLOWEEN_GATE_PROTOTYPE.png`: 1024×1536 RGBA, matching the original Boss Gate canvas/aspect; transparent violet recolor study based directly on `r2-upload/ui/dungeon-select/dungeon-gate-boss-v2.webp`.
- `gate/GATE_BEFORE_AFTER.png`: same-scale original Gold / Purple comparison.
- `gate/PLACEMENT_360.png`, `PLACEMENT_390.png`, `PLACEMENT_1280.png`: static map-placement studies at 360×800, 390×844 and 1280×900.
- `gate/PLACEMENT_MEASUREMENTS.json`: explicit proposal and rectangle evidence.

No architecture redesign was requested: original spires, central rune, door panels and proportions remain the visual reference. Imagegen recoloring is a concept study, not a pixel-identical geometry/alpha certification or final R2 export. Final source-locked export must be reviewed after concept acceptance.

**Placement observation:** proposed center X=31%, top Y=13% of the map, scale 0.72. This puts the gate left of Floor 10 and above-left of Floor 8; the image rectangles do not intersect those gates, the header/back area, sample currency strip or dock in the three studies. At 360px the horizontal gap to Floor 10's image is 12px; at 390px, 18px; at 1280px, 27px. Current scale appears usable as a starting point; Owner must accept arch centering and brightness.

**Evidence boundary:** source floor slot coordinates for Floors 7–11 are retained from `src/ui/components.js`; these are image composites, not an authenticated game capture or a responsive runtime test. The full portrait map is preserved for this placement study, including on desktop. Production currently uses a flexible `background-size: cover` map; DEV must confirm its cropping/coordinate behavior at integration. Currency values and surrounding UI are illustrative. Proposed event coordinates are not an approved runtime contract. No floor number or EVENT label is baked into the gate, and no Owner red annotation is present.

## B — Haloween nightmare — OWNER CONCEPT APPROVED

- `boss/HALOWEEN_NIGHTMARE_CONCEPT_SHEET.png`: design view, silhouette and reduced-size view of the same design.
- `boss/HALOWEEN_NIGHTMARE_IDLE_01.png`: one 768×768 RGBA transparent idle prototype, facing left.

Reaper, skeletal horse and crescent scythe are separately readable. Bone ivory contrasts with dark purple cloth; the scythe has clear negative space above the horse. The revised source leaves the complete scythe and tail within frame. Hooves form a stationary perspective footprint; there is no ground disk or baked scene.

**Fixed authoring registration:** generated 1280×1280 source uniformly scaled to 704×704, then placed at (32,24) on 768×768. No alpha trimming or bounding-box recentering. Prototype alpha bounds are recorded in `VALIDATION.json`. This establishes a proposed fixed canvas for later work, not a proven animation rig or runtime ground anchor. Preserve registration if the Owner accepts the design.

**Future production observation:** cloak and scythe are usable motion regions, but complex reins, bones and cloth may need simplification at battle display size. No frame-to-frame continuity, Attack, Death, sizeClass binding or animation QA has been performed. `sizeClass: large` / `anchorType: ground` remain future targets from the task.

## C — Excaliburnt

- `excaliburnt/EXCALIBURNT_MASTER_UPRIGHT.png`: upright master; silver Excalibur-like blade, gold guard, purple grip, grey rounded irregular boulder attached at the blade tip, which is completely hidden inside solid rock.
- `excaliburnt/EXCALIBURNT_ICON_512.png`: 512×512 RGBA transparent icon derived from that same master; icon-only padding/rotation normalization is separate from fixed-canvas wearable registration.
- `excaliburnt/EXCALIBURNT_DESIGN_REVIEW.png`: master/icon and actual 24/32/40/64px icon samples.
- `excaliburnt/EXCALIBURNT_IDLE_01_WEAPON_ONLY.png`: complete weapon-only 768×768 RGBA; no Hero/hand pixels.
- `excaliburnt/HERO_GRIP_REVIEW.png`: unchanged Base + weapon, manifest-selected Azure + weapon, and Azure reference.
- `excaliburnt/HAND_OCCLUSION_COMPARISON.png`: raw composition versus a separately labeled authoring hand-overlap study.
- `excaliburnt/GRIP_DETAIL_*.png`: enlarged grip evidence. Transparent full-canvas composites accompany these sheets.

**Registration:** master 1024×1536; selected source grip (512,1250), scale 0.205, clockwise rotation 135°, target grip (270,505), fixed 768×768 viewport [0,0]. Transform is baked offline. No runtime Y=84 was added. Base SHA-256 matches the approved Gate 0 ledger: `1c4e9d24d7d560b96e85dbdbccc47d17739c156a1377d4afb7f53fd90983e5e5`.

**Grip observation:** the raw Base/Azure composites expose the normal hand-over-weapon layering question. The authoring study restores actual Base hand pixels from [240,475,60,65] at their unchanged coordinates after the weapon. That hand exists only in the separate review composite, never inside the weapon image. This shows a plausible grip; it does not authorize an extra runtime pass, a global draw-order change or applying Leather-specific crops to Azure. DEV must resolve supported equipment/hand occlusion before final publication. Raw evidence remains alongside the study.

**Size/readability observation:** enlarged stone is wider than the crossguard and reads as a hammer-like distal mass, while the long exposed blade preserves sword identity. Idle_01 weapon alpha fits inside the canvas with its lowest alpha at y=722; no edge clipping. The stone is lower than Hero's boots in this downward rest pose. Owner must judge its weight/ground clearance; future attack sweeps must be fitted per pose, rather than reusing the Idle transform. At 24px the stone/blade outline remains the strongest cue and fine runes disappear, as expected. No attack-fit acceptance is claimed.

Identity remains **Sword / Mythic / Tier by drop floor / no unique status**. No item catalog, stats or gameplay field was changed.

## Preflight and verification

Read AGENTS.md, H01, Active Roadmap V3, Equipment Sprite Pipeline V1 and Master Template V1. Inspected current gate/map files, manifest-selected Azure Idle_01 layers and sword, Base, boss icon and boss weapon frame conventions. The existing boss weapon convention declares eight weapon paths with transparent Death layers; only one new Idle prototype was created here. Gate 0 was reused, not recreated.

`VALIDATION.json` records PNG decode/mode/dimensions/alpha bounds, source hashes and static rectangle intersections. `SHA256SUMS` covers the package's other files. These are file/preparation checks only. **Runtime, Phaser, WebGL, real-device, battle, full regression, staging and release QA: NOT RUN. No QA PASS is assigned.** Source/build files did not change, so no game build or game version bump is needed.

Imagegen built-in mode created/revised the artwork; ImageMagick/Sharp performed technical canvas registration, icon export and evidence composition without redrawing Hero sources. Prompt specifications and offline commands are in `working/PROMPTS.md`; `working/prepare-review.cjs` reproduces review sheets from the selected prototypes and pinned repository inputs.

## Boundaries and next action

No full boss or weapon frame set, R2 upload, manifest edit, runtime/backend change, deployment, main merge, unrelated equipment modification or Admin PR #182 change. Review publication, if present, is an isolated draft only.

Project Lead + Owner review **A palette/arch scale**, **B mounted boss/silhouette**, and **C stone size/grip/icon** independently. Record decisions before authorizing H01-04 final gate export and full boss/weapon frame production. Stop at this review gate.

## Owner review update — revision 2

Gate and boss concepts accepted by Owner; both prototype artwork files preserved unchanged. Excaliburnt revised at Owner request: no visible blade on or above the stone, and a rounded natural boulder outline instead of a rectangular block. Master, icon and Idle composite derivatives refreshed together. Excaliburnt revision 2 visual acceptance: OWNER APPROVED. No remote publication or full production authorized.

## H01-03 closure — Owner approved all three concepts

Owner accepted Excaliburnt revision 2 and instructed Graphics to return the work to Project Lead. Gate, Haloween nightmare and Excaliburnt concepts are approved. This closes concept visual review only. Project Lead must authorize H01-04 separately before full boss/weapon frame production or final gate export. R2, manifest, runtime, QA and release gates remain unchanged. Remote GitHub publication remains unperformed.
