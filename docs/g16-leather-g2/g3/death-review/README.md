# G16 Death — final G3 artwork

**G16 G3 ARTWORK COMPLETE — G4 VISUAL QA PENDING**, 2026-10-28. Main checked 614d8e3; existing Draft PR #160. Final inventory and current handoff: [G3 README](../README.md) / [Project Lead handoff](../PROJECT_LEAD_HANDOFF.md).

Death_01: Owner accepted helmet [-2,-8] and torso [-2,-6] at 52252e2. Exact offline integer placements are baked into its seven paths; actual reassembly remains pixel-identical to the accepted preview. The latest accepted comparison is preserved in qa/DEATH_01_OWNER_APPROVAL_SHEET.png.

Death_02: canonical bowed/kneeling anatomy, original face/expression, approved Leather material and foreground anatomical right arm (arm_rear) are retained. Owner's final instruction: raise helmet 8px then submit. Its existing helmet PNG is moved [0,-8] with no interpolation or clipping; the other six Death_02 files and all 49 other final-frame files remain byte-identical to 03b50c0. No new generated artwork is used for this final correction.

DEATH_02_COMPARISON.png shows canonical Base, current-main Azure resolver and final Leather using one common canvas crop/scale. DEATH_CONTACT_SHEET.png, DEATH_PARTS_SHEET.png, ../qa/FULL_SET_CONTACT_SHEET.png and animation GIFs are refreshed from the actual exports. The superseded right-arm before/after comparison has been removed; Git history retains the earlier checkpoint.

The distinct Death_02 was constructed from isolated approved Idle helmet/chest material using clothing-only TPS plus three bounded built-in ImageGen sleeve/glove/folded-leg RGB donors. No donor anatomy, whole Hero or generated face was admitted. Exact prompts, target/design inputs, complete donors, guides and masks remain in masters/ and DEATH_02_PLACEMENT.json. Use build.py for Death_01, build_death02.py for Death_02, and ../build_current_qa.py for final integrity checks and reassemblies. Each piece owns its hidden insertion material; underlay stays transparent. Death sword stays transparent under the approved no-grip/released-weapon pose contract.

Death_01 uses Base → legs → both arms → torso → helmet; Death_02 uses Base → legs → left arm → torso → helmet → right arm (empty paths omitted). These are art assemblies. Death_02 foreground arm order and Attack order/crops still need separate DEV compatibility review; no runtime/profile source is changed. Empty Death weapons need no post-sword crop.

Owner accepted G3 handoff subject to the exact final helmet lift. G4 full-set visual/animation QA and later runtime/publication gates remain pending. No R2, production manifest integration, merge or deployment authorization is implied.
