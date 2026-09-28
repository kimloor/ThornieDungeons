# Approved export — 2026-09-28

User selected **background B** and approved all three frames, both icons and R2 publication.

Final assets are staged under the proposed paths below; all six mappings are now in `r2-upload/manifest.json`. Exact dimensions, anchors, alpha checks and SHA-256 hashes are in `r2-upload/ui/arena/GRAPHICS_CONTRACT.json`. Export QA on light/dark backgrounds and 24px/64px icon samples: `export-qa.png`.

All frame canvases are 512×512, centered at (256,256), with visible art within radius 247 (current circular clip is radius 256). A conservative common face-safe transparent disc is radius 113; ornament intrusion differs by rank. Preserve the approved art and use this bound when fitting future avatar faces. This is distinct from the old decorative frame; no current Player Card code was changed. Background is 1080×1920 RGB WebP quality 88; icons are 256×256 RGBA with transparent padding.

Validation: exact dimensions/modes, transparent corners, frame circular bounds, manifest/file paths, preservation of every existing manifest value, and visual inspection of actual exported assets passed. No source/build/runtime files changed; no frontend/API deployment. Asset upload is performed by the existing main-branch R2 workflow and must pass its download/SHA verification. The generated R2 object inventory remains owned by the scheduled/manual sync workflow.

The following section is the historical concept review, retained with its masters for traceability; its pending-approval statements are superseded by this approval record.

---

# W9 Graphics — visual approval batch

THORNIE_GRAPHICS_HANDOFF
STATUS: READY_FOR_PROJECT_LEAD_REVIEW

Branch: `graphics/w9-arena-v2-pack`
Base main: `c101ead2e4a36ed7bed9c895fe9aadbb16400ebf`

## Scope and evidence

Read AGENTS.md, ARENA-V2-W9.md, PHASER-COMBAT-ARENA-V1.md, both manifests, R2 README, Player Card source/CSS and asset bytes. Implementation roadmap is absent on this main; read it from the existing remote W9 branch without checking out or modifying that branch.

Current background: `assets.battleUi.background` → `ui/battle/battle_background.webp`: 1080×1920 RGB WebP, 683700 bytes. Encoder quality is not recorded, so do not claim an exact existing compression setting.

Current frame: `assets.playerCardUi.avatarFrame` → `ui/social/player_card/avatar_frame.png`: 512×512 RGBA. This is decorative UI, not a global entitlement. Metadata reference card is 960×600 with frame placement [65,67,256,256], portrait clip center (193,195), radius 96. Live CSS is authoritative for current display: avatar width min(82%,190px), 88% on ≤430px; circular overflow:hidden, frame fills 100%, head image is 82%. New crowns must stay inside the circular clip. Final frames need identical centered openings and face-safe area; the comparison artwork is not yet a validated export contract.

Currency audit: searched all r2-upload paths and both manifests. Gold and Diamond exist at `assets.itemIcons.currency.gold` / `.diamond`, paths `ui/item-icons/currency/gold.png` / `diamond.png`, both 256×256 RGBA. No Arena Coin/Ticket asset or manifest mapping found. Both are NEW concepts; no approved artwork replaced.

## Review deliverables

- background-a.png: 941×1672 RGB PNG concept, warm dusk colosseum. Recommended for stronger separation from Dungeon.
- background-b.png: 941×1672 RGB PNG concept, blue thorn colosseum.
- frames-comparison.png: 2172×724 RGBA sheet, Rank 1/2/3 left to right. Gold crown / silver diadem / bronze crest. Not three final standalone exports.
- arena-coin-concept.png: 1254×1254 RGBA, blue/silver crossed-swords coin.
- arena-ticket-concept.png: 1254×1254 RGBA, red/gold notched ticket.
- review.html: mobile crop/reserved-zone study, frame scale study and new icons beside existing currencies at 24px. Static graphics review only; no gameplay or Phaser implementation.

Generated with built-in imagegen. Background prompts require outdoor roofless colosseum, visible sky, thorn/vine edges, calm matte ground, mirrored 2v2 space, no actors/UI/text/target markers. Frame prompt requires a coherent centered circular family, transparent face opening and gold > silver > bronze hierarchy without text. Coin prompt requires blue/silver crossed swords; ticket prompt requires crimson/gold notched silhouette and helmet emblem. All are visual concepts pending approval, not production masters.

## Proposed publication contract — pending approval

| Asset | Proposed R2 path | Proposed key under assets | Final target |
|---|---|---|---|
| Selected background | ui/arena/arena_background.webp | arenaUi.background | 1080×1920 opaque WebP |
| Rank 1 | ui/profile-frames/arena_rank_1.png | profileFrames.arenaRank1 | 512×512 RGBA PNG |
| Rank 2 | ui/profile-frames/arena_rank_2.png | profileFrames.arenaRank2 | 512×512 RGBA PNG |
| Rank 3 | ui/profile-frames/arena_rank_3.png | profileFrames.arenaRank3 | 512×512 RGBA PNG |
| Coin | ui/item-icons/currency/arena_coin.png | itemIcons.currency.arenaCoin | 256×256 RGBA PNG |
| Ticket | ui/item-icons/currency/arena_ticket.png | itemIcons.currency.arenaTicket | 256×256 RGBA PNG |

Arena/profileFrames are proposed new families, not existing keys. UI paths follow r2-upload/README.md and currency paths extend the existing family. No files staged in r2-upload, no manifest updated, no R2 upload, no merge/deploy. Generated inventory manifest must use `.github/workflows/sync-r2-manifest.yml` after approved publication, not manual edits. R2 upload runs on main and verifies downloaded SHA-256.

## Validation and remaining gate

- Concept image dimensions/modes checked from actual bytes; transparent concepts contain alpha 0–255, backgrounds opaque.
- Visual review: no dynamic text or baked UI in artwork; distinct material hierarchy and icon silhouettes.
- Mobile preview is a static crop/scale study, not a live iPhone or Phaser test; actual actor scale/anchors remain W9 staging work.
- HTML asset references resolve. Browser screenshot verification was blocked because Chromium is absent in this environment; open review.html for actual 24px icon review before final export.
- Final frame geometry, crown clipping, face opening, alpha edges on light/dark backgrounds, icon padding, compression and exact manifest/file validation remain final-export gates after approval.
- Changes confined to this review folder. Hero/Pet/Equipment, gameplay, backend, schema and production manifests untouched.

Next action: Project Lead selects A or B, reviews the frame family and Coin/Ticket, and approves or revises proposed paths. Then polish/export selected assets, validate exact geometry/transparency/mobile readability, and prepare approved asset publication through the normal pipeline.
