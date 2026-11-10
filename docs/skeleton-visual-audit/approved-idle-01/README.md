# Skeleton Idle_01 — Owner-approved in-place replacement

Owner approved revision07 and explicitly authorized replacing existing files on 2026-10-29. Scope: helmet, torso_armor, arm_rear, legs_boots, Idle_01 only. Sources are exact revision07 candidate bytes; approved Chest and Arm Rear use the complete Owner-uploaded artwork fitted in revision05, Pants uses approved B placement and three approved local repairs, Helmet retains the accepted earlier correction.

BEFORE-AFTER.png, THREE-POINT-DETAIL.png and FULL-AFTER.png are the actual approved preview evidence. PUBLICATION.json records old/new object hashes and verification state. Original assets can be restored from the parent commit if rollback is required; restore the corresponding SOURCE_VALIDATION hashes together and let the changed-path R2 workflow upload them.

Four PNGs retain canonical paths, RGBA768 canvases, baked placement and existing runtime order/hair semantics. Original Base, Runtime, Manifest, Underlay, Arm Front, Sword and all other frames are unchanged. This is not authorization to extend the correction to Idle_02–03 or Attack/Death. Those frames retain the old artwork and may visibly differ during animation; full animation acceptance is not claimed by this single-frame publication.

Checks: exact approved bytes staged; four PNG decode/format checks PASS; existing Skeleton tests3/3 PASS. No source code changed, so generated build was not regenerated. R2 upload/read-back and production review status tracked separately in PUBLICATION.json. No debug/intermediate artwork is part of the publication commit.

Publication complete: asset commit b21d5105660b3e23a27ee2163daf410c263ec27d; R2 run40809505708/job123236221846 verified6/6 objects, including4 PNGs. Public Browser decode4/4 at768x768 passed using cache-busted asset URLs. Owner in-game Production visual review remains pending. No frontend code/version change was made for this in-place asset upload.
