ThornieDungeons — G16 G3 Source Revision Handoff
Status: PHASE A ATTACK_01 REVIEW HOLD — NOT G3 COMPLETE
Risk: MEDIUM
Latest main checked: 32bca9eca232355a2ae98bc5f3fd54e9c5d28637
PR: #160 (existing draft) | Branch: art/g16-g3-leather-frames

Per-pose reconstruction used canonical Attack_01 Base + approved G2 appearance, followed by bounded equipment repair masks. No old rejected source pixels reused; no anatomy/limb transforms. Seven isolated candidate PNGs, actual full-set/weapon-free composites, 50% Base overlay, enlarged cheek/shoulder/wrist/grip review, provisional crop and complete sword registration are in docs/g16-leather-g2/g3/revision-a/.

Checks: 7 candidate PNGs 768x768 RGBA/origin0/no edge clipping PASS; underlay transparent. Face-core RGBA identity PASS. Bounded repair changed zero pixels outside recorded masks. All Base hashes 8/8 and previously validated Idle PNG bytes 21/21 unchanged. Actual merged resolver accepts candidate order/crop metadata offline only; final crop clearance is not accepted.

Blockers: cheek/temple contour and raised pauldron differ from G2; helmet's occluded region and sleeve cap remain incomplete; slot extraction has shoulder/skirt contamination and minor skin/seam defects. See ATTACK_01_DETAIL_REVIEW.png and ATTACK_01_SEVEN_LAYER_REVIEW.png. Do not promote these candidates to final exports.

Inventory: final 21/56 retained; 7 candidate paths NOT counted; 35 final paths missing. Other four poses not started because explicit Phase A stop gate applies. G4 NOT READY.

Next: Project Lead/Owner review material cheek/shoulder contour differences; then continue Phase A source completion/clean isolation against the same canonical Base. The reconstruction method is already authorized and does not need approval again. Once Phase A passes, complete remaining four poses/35 final paths, final hand crops, animation/contact sheets, and G4 handoff. No R2/runtime/live manifest/manual deploy/Base/Azure/Skeleton/gameplay/economy/Worker/API/D1 changes. Production NOT VERIFIED.
