# H01-04 Final Graphics — Project Lead Handoff

Status: **REVIEW READY / PACKAGE C REVISION REQUIRED / NOT READY FOR H01-07**

Branch: `art/h01-04-final-graphics`. Latest verified main: `e556e177d046d00126fa9fae95d81cd3ea37fc4c`. Owner authorized the approved chat images as sources; `SOURCE_LOCK.json` pins the accepted Gate/Boss and Excaliburnt revision 2.

Prepared under `docs/h01-halloween-production/`:
- A: 1024×1536 lossless Halloween Gate WebP Alpha; original Gold gate unchanged; before/after and 360/390/1280 static map studies. **PASS for export/file checks; PL visual acceptance pending.**
- B: all 7 boss RGBA PNGs at 768×768, left-facing, fixed canvas, contact sheet, Idle/Attack/Death GIFs and source/ground evidence. **PASS for offline coverage/file checks; PL visual acceptance pending.**
- C: 512×512 item icon, 8 declared 768×768 `sword` PNGs, weapon contact sheet, 56 Hero composites over 7 equipped states, grip details and exact current layer-contract lists. **REVISION REQUIRED for hand occlusion compatibility.** Two Death PNGs are intentional transparent layers following current boss-weapon/Azure convention, not eight visible weapon poses.

Evidence: `INVENTORY.json`, `VALIDATION.json`, `MISSING_FAILED_ASSETS.json`, `SHA256SUMS`, `FRAME_CONTRACT.json`, `qa/`, original selected boss source files and preparation script.

Important findings:
1. Actual current layer contract provides the required hand pass/foreground behavior for Leather gloves, but bare/no-glove and legacy/mixed-glove cases still show incorrect grip overlap. No Hero pixels were painted into weapon files, no hand-shaped holes and no global order change were used to conceal it.
2. Current EquipmentVisualResolver has no Excaliburnt item-to-visual identity mapping. The inspection fixture injects texture paths only in memory; production manifest/runtime remains untouched.
3. Confirm whether Death should retain the existing empty weapon convention. A visible Death stone needs explicit reviewed grip/placement, which the current reference does not define.
4. Gate composites preserve portrait map framing, not actual responsive cover-cropping. DEV must validate world coordinates/mobile/desktop in a later authorized integration gate.

Verification boundary: 17/17 files present and decodable with target canvas/alpha; SHA ledger supplied; 56 offline composites use the unmodified current HeroV5RuntimeContract via isolated JS VM. **No Phaser/browser/device/Production runtime QA PASS, build/release PASS or final Owner animation approval is claimed.**

No R2 upload, manifest edit, runtime/backend/gameplay/economy change, deploy or main merge. Existing Boss Gate, G16/Skeleton/Hero assets and Admin PR #182 untouched.

Next: PL independently inspects A/B and C artwork; route C hand-occlusion/item-binding interface and Death visibility clarification to scoped DEV review. H01-04 completion remains open; do not authorize H01-07 from file existence alone.
