# G16 Gate 3 — Idle expansion / pose review hold

Status: **G16 G3 PHASE A REVIEW HOLD — SOURCE RECONSTRUCTION AUTHORIZED; ATTACK_01 CANDIDATE NOT ACCEPTED**.

Source revision update: see [Phase A README](revision-a/README.md) and [enlarged detail review](revision-a/qa/ATTACK_01_DETAIL_REVIEW.png). Per-pose reconstruction and bounded paintover were authorized and attempted for Attack_01. Seven candidate PNGs are isolated from final exports; approved final inventory remains 21/56. Material cheek/shoulder contour differences and hidden-material/extraction defects still block Phase A. Original whole-sheet attempt remains rejected. The sections below retain the earlier attempt history; the current revision disposition is in revision-a/.
Risk: MEDIUM. Checked main: `1372ed16327aeb7290b1bad0a9c2fa022b425335` (newer than assigned `b3c44c1`; intervening Admin merge does not change equipment contracts). AGENTS.md, Master Template, Pipeline §4B/§4C, runtime contract, current manifest and R2 README read. Gate 0 reused; no Base, default-hair, relevant manifest selection or runtime source drift from task baseline. PR #156 is merged; historical G2 pending-review wording is not rewritten.

## Deliverables and limits

- `exports/idle_01/`: all seven locked G2 PNG files, copied byte-for-byte. Original evidence is untouched.
- `exports/idle_02/` and `exports/idle_03/`: fourteen new fixed-canvas RGBA PNGs. The canonical Bases are exact RGBA translations of Idle_01 by (0,-12) and (0,-4), verified before applying those same offline translations to every equipment layer. No per-part movement, rescaling, interpolation or Y=84 runtime offset is used. Full-sword master is preserved.
- `qa/IDLE_CONTACT_SHEET.png`, `qa/idle_preview.gif`, and three actual layer composites: idle review material. Idle_01 composite matches the approved preview pixel-for-pixel; the other composites match its exact Base translations.
- `IDLE_METADATA.json`: offline fixture only, **not an approved production manifest**. Merged runtime profile/hair mode and cropped arm_rear pass are used.
- `VALIDATION.json`: all **56 expected paths** explicitly listed, **21 present / 35 missing**. Dimensions, mode, nonzero alpha, alpha bounds, canvas-edge clipping, byte hashes and Base hashes are recorded. Empty underlay has its required reason.
- `masters/weapon_free_pose_attempt_01.png`: rejected ImageGen source attempt. Generated idle cells are also rejected; they never replace the approved Idle_01.
- `qa/POSE_DRIFT_REVIEW.png`: generated Attack/Death candidates overlaid with cyan unchanged Base. Only one uniform whole-sheet scale is applied to recover the 384px reference-cell layout; no per-body registration is used to conceal drift.

## Crop disposition

| Frame | Crop [x,y,width,height] | Disposition |
| --- | --- | --- |
| idle_01 | [0,493,768,42] | Approved reference, unchanged |
| idle_02 | [0,481,768,42] | Exact -12 Base translation; offline verified |
| idle_03 | [0,489,768,42] | Exact -4 Base translation; offline verified |
| attack_01–03 | Unset | No accepted per-frame arm export; must inspect actual hand before defining |
| death_01–02 | Unset | No accepted per-frame arm export; must inspect actual hand before defining |

Merged `HeroV5RuntimeContract.js` was exercised with the idle fixture: all three frames resolve `base → coverage_underlay → legs_boots → arm_rear → arm_front → torso_armor → helmet → sword → right_hand_occlusion`, hide default hair, and return the matching crops. The full 768px crop width is safe for these exact idle translations because arm_rear and the sword move together. This does not certify other poses, mixed-set visual quality or G5 runtime integration.

## Blocking visual findings / exact next action

The first weapon-free whole-sheet attempt changes anatomy placement and costume details materially. In particular, Attack_01's raised glove and opposite forearm do not register to Base, Attack_02/03's extended/lowered hands drift, Death_01's torso/limbs drift, and Death_02's kneeling head/arms do not fit the unchanged Base. Helmet ridges, cheek panels and shoulder proportions also vary from the locked artwork. These are not accepted as permissible armor silhouette extensions. The candidate face artwork must never be used to replace original facial anatomy.

Per the task's explicit instruction, **“Stop ... and request Project Lead/Owner review if any frame materially deviates from the approved visual design”**, production of the five affected frames is paused. Do not extract these candidates into final slots or fabricate transparent placeholders to claim 56/56. Proposed continuation for review: retain the exact idle results; retry bounded per-pose weapon-free source edits against full-size Base and the locked design, or use an approved editable rig/paintover source. Never normalize limbs independently to conceal mismatch. No runtime architecture expansion is proposed. Anatomical right-hand grip and its association with arm_rear remain unverified for the five blocked poses.

**G3 is not complete; G4 all-frame QA is not ready.** Attack/Death composites, animation previews, crops and their 35 PNGs remain absent. Idle visual sign-off remains with G4/Owner. No R2 upload, live manifest edit, build/deploy, gameplay/economy, Worker/API/D1, Base/Azure/Skeleton edit, CI/Production PASS or publication is included.

## Reproduction

From repository root: `python docs/g16-leather-g2/g3/build_idle_evidence.py` (Pillow + NumPy), then `node docs/g16-leather-g2/g3/verify_runtime.cjs`. After adding/editing documents regenerate the evidence hashes with the Python script. Run `sha256sum -c SHA256SUMS` within this folder. These are scoped offline checks; a full runtime/build regression is deferred to G5 because no runtime source changed.

Image generation used the built-in ImageGen tool; see `PROMPT.md` for the prompt specification and input provenance. Rejected source native size is recorded in VALIDATION.json. No source master was overwritten.

## Latest Attack_01 continuation checkpoint

**ATTACK_01 BOUNDED OVERLAP EXPERIMENT — OWNER VISUAL REVIEW PENDING.** See [review and limitations](owner-selected-recut/attack_01/bounded-overlap-review/README.md). All seven candidate export bytes and protected Idle artwork remain unchanged. Offline visibility masks expose the chest skirt/shoulder plates but leave a raised-shoulder ring; actual Leather runtime fixture separately shows helmet/bracer overlap outside the proposed hand crop. This is not visual acceptance, runtime readiness or final-56 inventory promotion. Current prototype supersedes old blocked-source continuation notes for Attack_01 only; rejected source pixels remain rejected.

## Azure layer order recheck

Owner requested a fresh part-by-part Azure order inspection: see [exact order and cumulative stages](owner-selected-recut/attack_01/azure-layer-walkthrough/README.md). This view uses complete unmasked parts, with no cropped hand or torso redraw. Leather matches the prior unmasked Azure-anatomical-order checkpoint pixel-for-pixel; the different arm filenames are explicitly mapped. Order is verified; artwork fit remains pending.
