# ThornieDungeons — Hero V3 Asset Architecture

Updated: 2026-09-05

## Decision

The previous Hero001 skeletal/modular runtime is retired because the produced body-part assets were not reliable enough for production assembly.

The replacement architecture is Hero V3:

- one approved full-body Base Hero image;
- transparent overlay artwork for Hair, Hat, Outfit, Arms, Shoes, Weapon and Wings;
- IDLE and ATTACK only;
- animation parts are cut only when a specific animation actually requires them;
- no runtime skeleton, joints, local pivots or Hero001 rig compositor.

## Runtime layer order

1. wings
2. base
3. hair
4. outfit
5. shoes
6. arms
7. hat
8. weapon

## Target R2 paths

```text
sprite/characters/hero001/v3/
├─ base/hero_base.png
├─ hair/hair_blue.png
├─ equipment/
│  ├─ hat/hat_angel_crown.png
│  ├─ outfit/outfit_azure_armor.png
│  ├─ arms/arms_azure.png
│  └─ shoes/shoes_azure.png
├─ weapons/weapon_azure_sword.png
├─ wings/wings_angel.png
└─ animations/
   ├─ idle/
   └─ attack/
```

The animation directories may remain empty until static assembly is confirmed.

## Runtime manifest schema

Hero placement lives in R2 `manifest.json`, not in hard-coded rig data. Each overlay may be a string path or an object with:

- `path`
- `x`
- `y`
- `scale`
- `rotation`

Example:

```json
{
  "assets": {
    "hero001": {
      "v3": {
        "canvas": { "width": 1254, "height": 1254 },
        "base": {
          "idle": {
            "path": "sprite/characters/hero001/v3/base/hero_base.png",
            "x": 0,
            "y": 0,
            "scale": 1
          }
        },
        "defaults": {
          "hair": "blue",
          "hat": "angelCrown",
          "outfit": "azureArmor",
          "arms": "azure",
          "shoes": "azure",
          "weapon": "azureSword",
          "wings": "angel"
        }
      }
    }
  }
}
```

## Code migration completed

- removed Hero001 rig loading and rig cache code from `src/assets/manifest.js`;
- removed `HeroModularComposer`;
- removed `HERO_BODY_LAYER_ORDER` and all rig placement hacks;
- added `HeroOverlayComposer`;
- changed `HeroSprite` to use Hero V3 only;
- removed old rig/modular CSS runtime styles.

## R2 cleanup still required

The old R2 objects physically remain until they are deleted from Cloudflare R2. They should not be referenced by the new runtime manifest.

Delete/archive after the V3 files and manifest are uploaded:

- `hero001_rig_v1.json`
- `sprite/characters/hero001/modular/*`
- obsolete Hero001 old core/body-part assets
- legacy `sprite/hero/idle.png` after confirming no external reference

Do not delete Monster/Pet/Equipment directories that are unrelated to the retired Hero001 rig.
