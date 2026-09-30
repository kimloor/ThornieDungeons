# Icon assets batch 01 — review candidates

Status: READY_FOR_USER_REVIEW. All nine designs await approval. No R2 upload, manifest change, runtime integration, or gameplay changes.

- `asset-sheet.jpg`: labeled 3x3 review sheet, with 48px samples.
- `icons/*.png`: nine original 1254x1254 RGBA generated masters.
- `PROMPTS.json`: exact built-in image_gen prompt set.
- `VALIDATION.json`: dimensions, alpha bounds and SHA256 of each master.

Inventory: bossHorn, bossHide, recipeAzure, recipeRobot, recipeSkeleton, protectionStone, azureWing, robotWing, skeletonWing.

Recipes are shared per set. Wings are three base icons only; rarity effects will be supplied by existing runtime presentation later.

References: existing mana_ore inventory icon; approved Robot R3 and Skeleton R2 wing review sheets. Artwork and 48px samples visually inspected. Alpha present on every master. Some very faint peripheral alpha touches the canvas boundary: production normalization/edge cleanup remains a post-approval step; these are review candidates, not production-ready exports. No in-game QA claimed.

Next: obtain user approval by icon, revise rejected designs only, then prepare production-size transparent exports and publish only when authorized. Keep approved source masters and their hashes.
