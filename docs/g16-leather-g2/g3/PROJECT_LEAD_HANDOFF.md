G16 G3 ARTWORK COMPLETE — G4 VISUAL QA PENDING

Existing Draft PR #160 | branch art/g16-g3-leather-frames | latest main checked 614d8e363efa074d257319f3e3578a56196c2a06.

Owner accepted Death_01, corrected Death_02 right arm to foreground, then instructed: raise Death_02 helmet 8px and submit. Final helmet is an exact [0,-8] pixel translation from 03b50c08c06d5decb1cc9f246a3c0f70e4aa50b6. Other 55 equipment PNGs and all 8 canonical Bases remain byte-identical. Death_01 still matches its accepted preview pixel-for-pixel. No regeneration, anatomy change, runtime offset or extra exported PNG path.

Final 8×7 inventory = 56 G3-accepted 768×768 RGBA PNG paths. Dimension/alpha/edge/origin/SHA checks and exact final-shift preservation checks PASS. Empty underlay/Death weapon reasons, per-frame source hashes, art orders, Idle reviewed hand crops and unresolved Attack crops are declared in VALIDATION.json. SHA256SUMS verifies all 56 paths. Idle/Attack/Death contact sheets, GIFs, full-set sheet, Base/Azure comparisons and isolated Death pieces are refreshed. Source prompts/masters and approval evidence are retained; superseded status documents/ledgers and comparison drafts were removed per Owner request (CLEANUP.json).

Next: perform G4 full-set visual/animation QA. Separate DEV gate: Attack and Death_02 foreground right-arm ordering differs from leather_overlap_v1; Attack runtime hand crops remain unresolved. Empty Death swords need no post-sword hand crop. G5 renderer tests and G6 publication remain unapproved. No runtime, production manifest, R2, merge or deploy change. Keep PR Draft.
