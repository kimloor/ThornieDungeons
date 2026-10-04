# Pet Avatar Contract — G13

Status: **ACTIVE-DESIGN / READY_FOR_GRAPHICS**

G13 follows the completed G12 Hero Skill Icon Pack and owns Pet portrait/avatar presentation plus the shared custom Pet selector presentation. It does not change Pet gameplay, stats, rarity, progression, skills, Battle Core, Arena authority, or save data.

## Audit baseline — 2026-10-04

Authoritative Pet catalog: `src/systems/pets.js`.

Eight production Pet identities exist:

| Pet ID | Name | Rarity | Role | Existing battle sprite |
| --- | --- | --- | --- | --- |
| `sprout` | Sprout | R | Support | yes |
| `flamekit` | Flamekit | R | Attack | yes |
| `sparkpup` | Sparkpup | R | Control | yes |
| `ember_fox` | Ember Fox | SR | Attack | yes |
| `moon_hare` | Moon Hare | SR | Support | yes |
| `hell_wolf` | Hell Wolf | SR | Control | yes |
| `inferno_drake` | Inferno Drake | SSR | Tank | yes |
| `storm_phoenix` | Storm Phoenix | SSR | Control | yes |

All eight already have Idle/Attack/Death battle-frame families under `r2-upload/sprite/pet/<pet_id>/animations/`.

Audit result: **0/8 dedicated Pet portrait/avatar production assets currently exist.** The authoritative Pet definitions still carry emoji `icon` values for legacy/presentation fallback. G13 must not create new Pet identities or duplicate gameplay definitions.

## G13 asset contract

Create exactly one production portrait/avatar per authoritative Pet: **8 avatars total**.

Target runtime contract:
- 256×256 PNG with alpha;
- strong head/upper-body silhouette readable at small mobile sizes;
- visual identity must match the existing approved battle sprite for that Pet;
- one coherent portrait family across all eight Pets;
- no text baked into the image;
- follow the shared Production icon asset budget in `r2-upload/README.md`;
- keep editable/high-resolution masters outside runtime exports;
- stable path: `ui/pet-avatars/<pet_id>.png`;
- shared manifest group/resolver; no screen-local path maps.

G13 should reuse the existing Pet visual identity. It may derive/recompose a portrait from approved Pet artwork where quality is sufficient; it does not require a Hero-style layered/composite avatar system.

## Required runtime consumers

The same shared Pet avatar resolver should be reusable by:
1. Pets page/card presentation;
2. Arena Setup Pet selector;
3. Arena Battle Pet presentation where a portrait is required;
4. future Player Card/profile Pet presentation where applicable.

Missing/failed avatar loads must fail safely to the existing approved fallback and must never change Pet identity, selection, actions, combat, or saved setup.

## Arena Setup selector presentation

Replace the final native browser Pet `<select>` presentation with the shared game UI selector:
- selected state shows Pet avatar + name + level;
- picker rows show avatar + name + level and may show rarity/role when space permits;
- touch/mobile safe-area behavior must match the existing Arena UI;
- Pet selection authority and stored setup remain unchanged;
- do not redesign unrelated Arena Setup UI.

G13 does not own the Hero skill selector work completed by G12.

## Review / completion gate

G13 is COMPLETE only when:
- all 8 authoritative Pets have budget-compliant avatars;
- manifest + shared resolver are integrated;
- no screen-local duplicate mapping is introduced;
- Arena Setup no longer uses the native Pet dropdown in final presentation;
- required consumers render safely;
- fallback behavior is verified;
- mobile readability is reviewed;
- PNG decode and asset-budget audit are PASS with 0 REVIEW / 0 FAIL;
- build/tests pass where integration changes source;
- R2/Production verification passes when published;
- visible version is bumped for user-visible integration.

Any future authoritative Pet must add its avatar/manifest entry in the same feature batch.
