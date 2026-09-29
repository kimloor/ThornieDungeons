# R2 visual revision — review only

Latest review sheets: robot-asset-sheet-8-frames-r2.jpg and skeleton-asset-sheet-8-frames-r2.jpg. Both retain all eight frames, current Wing R5 and full-face helmet hair suppression.

Robot attack_01: the actual order already placed sword above helmet, but the arm_front cutout contained helmet/crest pixels and painted them above the sword. Tightened the arm cut to the approved source gauntlet/arm silhouette. Preserved sword bytes, grip target, helmet, pose and draw order; the glove still occludes the hilt.

Robot and Skeleton death_01: restored lower helmet/crest/neck boundary pixels from the approved pose atlases that were clipped by the previous masks. Repartitioned adjacent torso/arm cutouts to remove duplicated helmet pixels. No redraw, pose translation, anchor change or canvas change.

`layers/` contains the corrected 768×768 RGBA layers, addressed by their path inside the candidate ZIP. Apply these overrides over HERO_V5_ROBOT_SKELETON_REVIEW.zip; PATCHES.json records original and replacement SHA-256 values. The original ZIP and older GIFs remain the prior revision and do not contain these fixes. Rebuild these revised sheets with tools/revise_overlap_r2.py. Once approved, fold overrides into the next packaged candidate before DEV ingestion.

Only Robot attack_01 and both death_01 frames changed. All other frame source layers remain unchanged. Source art, sword PNGs, Base Hero, hair, Wing R5, r2-upload/**, production manifest and runtime remain unchanged. R2 NOT_PUBLISHED; new wings NOT_STARTED; in-game QA NOT_PERFORMED. User requested only two eight-frame sheets for this revision, so no new GIFs were produced.
