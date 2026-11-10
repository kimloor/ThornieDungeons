# Skeleton idle URL revision — 2026-10-29

Fix: assign `?v=skeleton_idle_r07_20261029` to exactly twelve manifest references: helmet, torso_armor, arm_rear and legs_boots in idle_01/02/03. Object keys and PNG bytes unchanged; other layers/frames/families unchanged.

Root cause: approved art was overwritten under the same image URLs. Worker responses default to public max-age86400; browser caches and Phaser's URL-based texture registry can therefore retain previous art. Manifest itself is already fetched using a timestamp and no-store. Versioning the image references gives browser and Phaser new keys while preserving canonical R2 objects and independent slot selection.

Validation: Skeleton integrity test now strips the query when opening local files/hashing canonical object keys. Added actual Inventory snapshot→asset resolver→texture key regression covering revised chest URLs across all idle frames, unchanged mixed-slot behavior, all twelve revised references and unchanged other frame/layer references. Skeleton + W8 + shared Phaser targeted tests64/64 PASS. No renderer, Worker, gameplay, asset artwork or frontend code changes; no frontend version/build needed for this manifest-only runtime selection change.

Deployment: existing changed-path upload workflow publishes r2-upload/manifest.json and verifies remote SHA256. Browser must reopen/reload the game to fetch the new manifest; an already-running game retains its loaded ASSETS object. No blanket no-cache header or global asset URL timestamp introduced.
