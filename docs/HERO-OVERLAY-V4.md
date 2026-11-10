# Hero Overlay V4 + Combat Presentation Contract

Hero V4 is the current production candidate. Every PNG uses the same transparent 1254x1254 canvas. Runtime placement is normally `x: 0`, `y: 0`, `scale: 1`, `rotation: 0`; alignment is baked into the files unless an approved manifest override exists.

## Runtime layer order

1. wings
2. weapon
3. base
4. hair
5. outfit
6. shoes
7. arms
8. hat

The weapon sits behind the base so the hand covers its grip in the idle pose.

## Equipment mapping

- `helmet` -> `hat`
- `chest` -> `outfit`
- `gloves` -> `arms`
- `boots` -> `shoes`
- `weapon` -> `weapon`
- `wings` -> `wings`

Azure visuals use `setId === "azure"`, with item-name fallback only for older-save compatibility. Wings remain an independent rear layer.

## Animation contract

- Hero combat currently uses Idle and Attack presentation.
- Attack uses 3 ordered frames.
- Approved base timing at x1 is 140 ms/frame; speed controls may scale runtime playback without changing source art.
- During Attack, only parts with matching attack sequences should switch frames. Static overlays reuse their idle artwork.
- Do not regenerate approved Hero/Pet/Monster artwork merely to optimize loading.

## R2 target paths

```text
sprite/characters/hero001/v4/
├─ base/hero_base.png
├─ hair/hair_topknot.png
├─ equipment/outfit_azure.png
├─ equipment/arms_azure.png
├─ equipment/shoes_azure.png
├─ equipment/hat_azure.png
├─ weapons/sword_azure.png
└─ wings/wings_angel.png
```

Attack frames:

```text
sprite/characters/hero001/animations/attack/hero_attack_[0-2].png
sprite/characters/hero001/equipment/attack/arms_azure_attack_[0-2].png
sprite/characters/hero001/equipment/attack/shoes_azure_attack_[0-2].png
sprite/characters/hero001/weapons/attack/sword_azure_attack_[0-2].png
```

## Combat anchors

- Hero: `x: 21%`, `y: 54%` of the battle arena.
- Pet: `x: 13%`, `y: 75%`.
- Three-monster formation: `(83%, 77%)`, `(77%, 64.5%)`, `(71%, 52%)`, front to back.
- Two monsters straddle the middle lane.
- One monster or Elite Boss uses the middle lane.
- Flying units use their floating anchor rather than the shared ground anchor.

## Combat UI contract

- Top area: Hero HP/SP/EXP, four fixed ATB/Turn Order slots, and Speed/Skip controls.
- Speed toggles x1/x2; Skip consumes only the Hero turn, then normal Pet/Monster order continues.
- Hero, Pet, Monster, and Elite Boss HP/status indicators sit above their battlefield sprites.
- Bottom dock: four Quick Slots on the left, Auto + Flee/Settings in the middle, Attack at far right.
- Settings manages quick-slot assignment; slot management should not be duplicated elsewhere unnecessarily.
- CSS remains responsible for responsive sizing, safe areas, hit targets, and interaction states. Image assets provide visual chrome only.

## Battle asset-loading rules

Before Battle becomes interactive, preload only encounter-critical assets:

- Battle UI chrome required on first frame;
- currently equipped Hero visuals;
- active Pet;
- current Monster/Boss idle assets.

After the first usable scene is ready, warm attack/death and other non-critical frames in the background.

Additional rules:

- Keep lazy loading for unrelated/non-visible assets.
- Preserve normal browser/R2 caching; do not add cache-busting to immutable images without a specific reason.
- Avoid repeatedly measuring transparent sprite bounds at runtime when stable bounds/anchor metadata can be stored or reused.
- Missing optional assets must degrade gracefully rather than breaking Battle.
- Any atlas/sheet consolidation must reuse approved frames and preserve animation behavior.

## Build rule

- Edit source modules, not generated `index.html`.
- Run `node build.js` after source changes.
- `index.html` is the single generated application entrypoint.
