# G16 Death artwork — current review

**Death_01 OWNER APPROVED / Death_02 OWNER REVIEW PENDING**, 2026-10-28. Main `614d8e3`, existing Draft PR #160. Current gate/inventory/handoff: [G3 README](../README.md) and [Project Lead handoff](../PROJECT_LEAD_HANDOFF.md).

## Death_01 accepted result

Owner accepted the final placement preview at `52252e222217c3b8207093d7dff59e3974c74698`: helmet left 2px/up 8px, torso left 2px/up 6px from the initial prototype. Those exact integer translations are baked into the existing seven layer paths; the other five files are byte-identical. The actual reassembly matches the accepted preview pixel-for-pixel. `qa/DEATH_01_OWNER_APPROVAL_SHEET.png` preserves the latest approved comparison. Superseded placement v1/v2 trial folders and the prior visual-hold sheet are removed. Original source checkpoints remain recoverable in Git.

## Death_02 candidate

`DEATH_02_COMPARISON.png` compares canonical Base, main-manifest Azure resolved through the actual resolver and the actual Leather seven-PNG reassembly. It uses one shared origin/crop/scale, without runtime Y=84. `DEATH_PARTS_SHEET.png` shows the isolated pieces. `DEATH_CONTACT_SHEET.png` shows both frames; all-frame contact sheets and animation previews are in ../qa/.

Canonical bowed/kneeling anatomy and original face/expression are preserved. Helmet and front torso use clothing-only TPS reconstruction from approved G2 isolated material, with explicitly recorded manual visual guides (not exact rig pivots). Three built-in ImageGen edits provide isolated sleeves/gloves/folded-leg material. Only donor RGB is admitted inside canonical per-part alpha masks; generated anatomy and donor geometry are rejected. Sleeve caps, chest shirt coverage and waistband insertion belong to their own equipment piece. `coverage_underlay` remains transparent. The Death sword is intentionally transparent because the pose releases it and the approved Azure contract specifies no grip.

Use `build.py` for accepted Death_01, `build_death02.py` for the distinct Death_02 (never a translation/rotation of Death_01), and ../build_current_qa.py for current validation, comparison sheets and animation previews. `DEATH_02_PLACEMENT.json` records the per-part guides and masks; `masters/death_02/PROMPTS.json` records exact built-in ImageGen prompts. Retained masters/ inputs, complete donors and masks are reusable source material, not additional exported paths.

Death_02 still needs Owner visual acceptance. Do not infer G3 completion, G4 visual approval or runtime/production readiness from file presence. Death_01 retains its accepted Base → legs → both arms → torso → helmet assembly. Owner corrected Death_02 to Base → legs → left arm → torso → helmet → right arm (empty paths omitted), bringing the anatomical right arm (arm_rear) in front of the armor. See DEATH_02_ARM_ORDER_COMPARISON.png. All 56 equipment PNG bytes are unchanged by this order-only correction. This foreground arm order still needs separate DEV compatibility review; no runtime/profile source is changed. Death weapons need no post-sword crop. Existing Attack order and crop review remains separate. No R2, production manifest integration, merge or deploy.
