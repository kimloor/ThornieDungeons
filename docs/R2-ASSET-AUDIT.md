# ThornieDungeons — R2 + GitHub Asset Audit

Audit basis: GitHub `main`, R2 `r2-manifest.json` snapshot, and the runtime `manifest.json` from R2.

## Architecture

- GitHub: source code and asset-loading logic.
- Cloudflare R2 bucket `assets`: game asset storage.
- Worker `thorniedungeons.ekqtjl.workers.dev`: serves `/assets/*` by mapping the URL path after `/assets/` directly to the `GAME_ASSETS` R2 binding.
- `src/data/r2-manifest.json`: GitHub Actions snapshot of objects currently present in R2; audit/reference only.
- R2 `manifest.json`: runtime manifest consumed by the game's asset loader; currently maps `hero001` modular assets.

## Confirmed runtime-manifest state

R2 `manifest.json` uses schema `thornie-assets-v1` and currently contains the `hero001` modular character mapping. It contains 35 PNG asset mappings covering core, head, torso, arms, legs, equipment, weapons, and accessories. Metadata identifies `hero001` as a modular character, PNG/RGBA, rig-ready.

## Hero001

Status: GOOD.

The current Hero001 modular body assets in R2 are consistent with the loader/compositor naming convention and runtime manifest. Core, head, torso, arms, legs, equipment, weapons and accessories are represented in the runtime manifest.

Equipment/weapon examples include Azure armor pieces, Ice Sword, Training Wooden Sword, Ornate Dagger, Red Tassel and Azure Cape.

No immediate path mismatch was identified in the confirmed Hero001 runtime-manifest mapping.

## Animation

Status: IMPORTANT / NOT COMPLETE.

R2 contains the `sprite/characters/hero001/animations/` directory marker, but no actual animation frame PNGs were present in the audited R2 object list. The current HeroSprite path uses the modular compositor/CSS animation approach rather than loading idle/walk/attack/hurt frame PNGs from R2.

Therefore this is an incomplete asset library rather than a current loader failure.

## Monsters / Enemies

Status: IMPORTANT / ASSETS MISSING.

The R2 object snapshot contains the `sprite/enemy/` directory marker but no actual enemy sprite PNGs. The code has enemy definitions and an EnemySprite loader/fallback path, but the audited R2 asset library does not currently contain the corresponding monster sprites.

Orc and Poring are MONSTERS/ENEMIES, not pets. They must be audited and implemented in the monster asset system.

## Pets

Status: IMPORTANT / ASSETS MISSING.

The R2 object snapshot contains the `sprite/pet/` directory marker but no actual pet sprite PNGs. Sprout exists in the current pet game data and is currently represented by an icon/emoji rather than an R2 sprite.

## Orc / Poring classification

Orc and Poring belong to the Monster/Enemy asset group. They must not be included in the Pet audit/system.

## Equipment

Status: PARTIALLY COMPLETE.

Hero001 modular equipment assets exist in `sprite/characters/hero001/modular/` and are present in the runtime manifest. Generic `sprite/equipment/` directories exist in R2 but contain no confirmed PNG assets. The current Hero001 architecture should continue using the hero001 modular assets unless a later generic equipment system requires otherwise.

## Legacy asset

`sprite/hero/idle.png` exists as an older/legacy asset and is not part of the current Hero001 modular runtime path. Do not delete until all code references are confirmed absent.

## Overall severity

### Critical

No confirmed Critical architecture failure in GitHub → Worker → R2 routing or the Hero001 runtime manifest.

### Important

1. Monster/enemy sprite library is missing actual PNG assets.
2. Pet sprite library is missing actual PNG assets; Sprout currently uses an icon/emoji.
3. Hero animation frame PNG library is not populated.
4. Equipment runtime integration beyond the current Hero001 modular asset mapping remains incomplete.
5. Orc and Poring still need to be implemented as monsters if they are intended to be playable game assets.

### Minor

1. R2 object count includes zero-byte folder markers; these are not actual image assets.
2. Legacy `sprite/hero/idle.png` should be cleaned up only after reference verification.
3. Some modular weapon assets are present but not currently used by the main HeroSprite path.

### No issue confirmed

- R2 bucket/binding architecture.
- Worker `/assets/*` routing design.
- GitHub Actions R2 manifest synchronization.
- Hero001 runtime manifest structure.
- Hero001 modular asset naming/path convention.

## Recommended sprite work order

1. Freeze the current Hero001 modular structure as the master baseline.
2. Finish/verify Hero001 equipment and weapon integration without moving the existing R2 paths unnecessarily.
3. Build the Hero001 animation asset set only when the chosen runtime animation approach requires frame PNGs.
4. Build the Monster sprite library, starting with Orc and Poring, then remaining monsters/bosses.
5. Build the Pet sprite library, starting with Sprout.
6. Define a consistent sprite/animation naming convention for Monster and Pet assets before uploading batches.
7. Add runtime-manifest entries for each completed asset group.
8. Run an automated asset-path audit so every code asset reference can be checked against the runtime manifest and R2 object list.
9. Remove or archive legacy assets only after the automated reference audit confirms they are unused.
