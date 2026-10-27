# Attack_01 — Azure layer-by-layer recheck

Status: **AZURE ORDER VERIFIED / OWNER VISUAL ACCEPTANCE PENDING**. Risk LOW, offline evidence only. Latest main `7ef31753b969386d2750857dddaa53d44c03081c`; branch parent `1ca732eba38a77a27a07adee5dd66c4ea6f395a1`. Mandatory master/pipeline read; unchanged references reused.

Owner requested another inspection of actual Azure front/back stacking before arranging Leather. `build.py` executes the actual current resolver, resolves current manifest paths including query versions, verifies the selected PNG bytes against latest main, and builds isolated-part and cumulative-stage evidence.

Back to front (later row covers earlier rows wherever their alpha overlaps):

| Step | Anatomy/content | Azure filename | Leather filename |
| --- | --- | --- | --- |
| 1 | Original body | base | base |
| 2 | Seam coverage | coverage_underlay | coverage_underlay (empty) |
| 3 | Chest and shoulder plates | torso_armor | torso_armor |
| 4 | Legs and boots | legs_boots | legs_boots |
| 5 | Extended arm | arm_rear | arm_front |
| 6 | Helmet | helmet | helmet |
| 7 | Complete sword | sword | sword |
| 8 | Raised sword arm | arm_front | arm_rear |

`LAYER_WALKTHROUGH.png` has eight steps, with columns Azure isolated / Azure accumulated / Leather isolated / Leather accumulated. `COMPARISON.png` shows final full-canvas assemblies. `ORDER.json` records source paths, real-byte SHA-256 and exact mapping.

No masks, hand crop, torso redraw, transforms, source trimming, filename rename or runtime changes are applied. This direct reassembly is pixel-identical to the earlier unmasked azure-order-correction checkpoint, verified by assertion. It establishes that the anatomical sequence was already correct there; it does not invent a new order merely to produce a different picture. The masked experiment from the preceding checkpoint is excluded from this result.

Visible consequence: legs cover the chest-skirt insertion and sleeves cover portions of the shoulder plates. Azure's selected leg/arm artwork has different coverage boundaries and its underlay is nonempty. Equal stacking does not imply equal visible occlusion. Keep this issue explicit; visual fit is not accepted. Merged leather_overlap_v1 has a different pairwise order and is not changed by this offline anatomical mapping. Base/Azure/approved Idle artwork and the complete sword remain untouched; no production manifest/R2/deploy.

Reproduce from repository root: `python docs/g16-leather-g2/g3/owner-selected-recut/attack_01/azure-layer-walkthrough/build.py`. Check SHA256SUMS from this directory. Preview crops/scaling are review-only; reassembled PNGs stay 768×768 RGBA at origin 0 with no baked Y=84.

Project Lead handoff: PR #160, Attack_01 exact Azure anatomical-order diagnostic published; check COMPARISON.png and LAYER_WALKTHROUGH.png. Order verified, no new artwork or runtime integration. Owner visual review remains pending, G3 incomplete/G4 not ready.
