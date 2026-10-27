# Attack_01 — cleaned chest and Azure-guided placement

Status: OWNER POSITION ADJUSTMENT REVIEW PENDING. Latest main checked: 7ef31753b969386d2750857dddaa53d44c03081c. Risk MEDIUM graphics-only authoring. Mandatory contract files unchanged; Gate 0 reused.

Owner approved the remaining piece appearances and requested: use the independently generated weapon, follow Azure grip/direction, clean chest again, and try Azure positions before owner-assisted manual adjustment. No approval of full-frame fit is inferred.

## Weapon

COMPLETE_SEPARATE_SWORD_MASTER.png is copied directly from the complete separately authored G2 weapon at docs/g16-leather-g2/exports/idle_01/sword.png, not from the previous Attack_01 derivative or a dressed-character crop. It contains blade, guard, full handle and pommel with no hand/body. Re-register the actual master using handle point [270,515] -> Azure's exact contract grip [310,309]. Leather's blade axis is rotated -172.86425466957812 degrees offline to match the current manifest-selected Azure Attack_01 sword's up-left blade direction. Scale1 preserves Leather weapon dimensions; its blade is shorter than Azure's by design. All transforms are baked into the 768px export; no runtime change.

## Chest cleanup

Built-in ImageGen isolated cleanup uses chest_before.png (the committed prior review chest) and the Owner's selected dressed source. The chopped horizontal armhole fragment, sleeve-like fragments and pasted strip are removed. Collar/back-neck, shoulder underside and armhole edges are reconstructed as one clean armor piece; no original-source pixel-identity claim. Raw donor preserved in chest_clean_raw.png; isolated result is exports/torso_armor.png and CHEST_CLEAN_DETAIL.png.

## Azure coordinates: exact versus visual reference

Azure's fixed canvas origin and all runtime x/y offsets are shared already; there is no canonical per-piece joint rig. Blindly equating alpha bboxes is wrong: Azure helmet has much larger ornaments, Azure trousers partly belong to its underlay, and Azure's raised arm is arm_front whereas Leather's raised arm must stay arm_rear for its merged hand pass. Anatomy is matched rather than renaming slots.

The exact canonical grip is [310,309]. Current Azure sword direction is read from its selected actual PNG. Azure buckle [344,516] and opposite-wrist deltas are manual image guides, not newly certified rig coordinates. Chest raw buckle [711,848] maps to [344,516] with uniform .26 scale and 13-degree offline rotation. Helmet and raised arm remain in their existing shared Base/grip positions; the opposite arm translates [2,-3], and boots [-1,0] to match the Azure left boot contact x218/bottom667. No artwork changes to these Owner-passed pieces, only recorded positioning. Base stays unchanged. See VALIDATION.json and PLACEMENT.csv.

## Visible result / owner adjustment needed

REVIEW.png and AZURE_COMPARISON.png are assembled from actual exported files on canonical Base with the merged Leather order and candidate crop [277,277,67,69]. Chest still misses the neck/opposite-shoulder join, leaving some neutral Base tank top visible. This is deliberately reported rather than covered by repainting Base, changing anatomy, resizing unrelated pieces or silently declaring fit PASS. Please mark desired chest translation/rotation on the comparison; the Owner explicitly offered to assist moving it if Azure-guided placement did not fit. Whole-frame visual approval and final hand crop clearance remain pending.

All seven review PNGs are 768x768 RGBA/origin0; dimension/alpha/no-canvas-edge clipping/SHA checks PASS. No shared coverage art, no runtime-offset baking, R2/manifest/deploy, Base/Azure/Skeleton, gameplay/economy/Worker/API/D1 edits. Review files are not promoted to the final 56-path inventory. The previously approved Idle bytes and prior review evidence remain preserved.

Reproduce: python docs/g16-leather-g2/g3/owner-selected-recut/attack_01/azure-alignment-review/build.py. Inputs outside this directory are current manifest-selected Azure references, original Base, committed prior Leather pieces (324cc1f) and approved separate G2 sword. Earlier review torso is read from committed bytes because its local workspace copy was empty; no unrelated working changes are overwritten.
