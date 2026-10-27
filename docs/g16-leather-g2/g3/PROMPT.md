# Built-in ImageGen source attempt 01

Mode: built-in image edit, transparent_background=true. No CLI/API fallback.
Input 1: `qa/base_pose_reference.png` — canonical eight Base poses arranged as four 384px cells per row, two rows, on a neutral gray review background.
Input 2: `../qa/reassembled_preview.png` — locked Owner-approved outfit.
Input 3: `../G16_OVERLAP_COMPLETION_ASSET_SHEET.png` — approved modular design details.

Prompt specification: Produce a transparent 1536×768 four-column/two-row weapon-free dressed Hero sheet in exactly the Base cell layout (Idle 01/02/03, Attack 01; Attack 02/03, Death 01/02). Preserve original pose, body proportions, facial expression, limb placement and anchors; do not center or independently normalize bodies. Match approved rich dark brown leather, brass edging/clasps/buckle, open-face full-hair-cover helmet, scalloped shoulder plates, gloves/bracers, knee guards and boots. Keep empty gripping hands at exact source positions. No weapons, scabbards, scenery, text, labels, grid, effects, or ground shadows. Match outlined hand-painted sprite style, not pixel art. Generated sheet is a source for later modular extraction, not final runtime evidence.

Outcome: REJECTED / REVIEW HOLD. The generated layout/pose and design drift; no generated pixel enters accepted exports. The three idle exports derive solely from the pre-existing approved G2 PNGs by exact canonical Base translations.
