G16 G3 DEATH_01 VISUAL HOLD — MATERIAL REGISTRATION DEFECTS

PR #160 remains Draft on `art/g16-g3-leather-frames`. Attack_02/03 rear torsos are APPROVED per the 2026-10-28 assignment; all 21 Attack files and 28 protected Idle checkpoints remain byte-identical. Latest main inspected: `614d8e363efa074d257319f3e3578a56196c2a06`; Gate 0 reused.

Death_01 has seven 768×768 RGBA prototype paths with actual reassemblies, same-scale Base/Azure comparison, isolated parts, bounded ImageGen donors/prompts, manual material admission masks, SHA/alpha checks and hand-occlusion metadata. Technical PNG checks pass; visual QA does not. Canonical geometry/face is preserved, but donor-to-contour registration causes smeared material at wrist/fingers and boot edges; Leather bracer/shin/knee rendering also needs approval. See `docs/g16-leather-g2/g3/death-review/FOCUSED_VISUAL_REVIEW.png` and `DEATH_01_COMPARISON.png`.

Death_02 is not started because the assignment requires review before continuing with material deviations. Inventory: 42 established paths, 7 unaccepted prototype paths, 7 missing Death_02 paths. No G3-complete / G4-ready / 56-accepted claim. No runtime, production manifest, R2, merge or deploy changes. Manual profile-order comparison is not runtime verification; prior Attack hand crops remain a separate DEV gate.

Next action: review Death_01's material/fit defects, direct a bounded isolated-part correction and accept that prototype before authoring the distinct collapsed Death_02. Preserve canonical Base and all approved Attack artwork. Reconcile the final 56-path inventory only after both Death frames are accepted.
