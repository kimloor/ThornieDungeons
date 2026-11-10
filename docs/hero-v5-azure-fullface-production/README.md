# Azure Angel full-face helmet — production V1

User approved mockup and replacement of the old Azure helmet in R2. Risk: MEDIUM, presentation-only. Eight native RGBA768 helmet PNGs overwrite the existing `hero/v5/g2/equipment/azure/<frame>/helmet.png` keys. Other armor, sword, base, hair and wing PNGs are unchanged. Manifest helmet URLs add `?v=azure_angel_fullface_v1` for cache separation.

Art generated with built-in imagegen from the approved mockup and the actual base pose sheet. Prompt: exact eight-cell4x2 helmet-only atlas, consistent white/gold closed faceplate, cyan central gem, navy visor, blue crown and swept side fins; three idle, three attack, raised-face death01 and bowed-head death02; no hair/skin/body/weapons. Transparent extraction pass retains the same design. `sources/` preserves the atlas; `compose.py` reproduces native placement, clean transparent RGB and review composites; `finalize.py` writes metadata and slow review GIFs. All three idle frames reuse identical art with the base's -12/-4 vertical offsets.

Runtime adjustment reads `fullFaceHelmet` from the manifest and suppresses both hair layers only when the selected Azure helmet is present. Hair returns when unequipped, with an open helmet, or when the helmet bundle falls back. Version badge 1.0.18. No combat, economy, saves or item rules changed.

Verification: native RGBA768, no canvas clipping, zero RGB under alpha0; visual inspection of all eight composites including complete death chin and attack sword/front-hand order; unchanged non-helmet armor hashes in validation. `node --test tests/w8-hero-preview.test.js tests/phaser-shared-architecture.test.js`:60 PASS. `node build.js`:PASS. `HELMET_VALIDATION.json` is the current helmet validation; `SOURCE_VALIDATION.json` remains the historical original package receipt.

R2 upload/download checksum workflow and frontend deployment must succeed before claiming publication complete. No interactive in-game QA claimed.
