# Hero overlay V4 production candidate

Hero V4 keeps every PNG on the same transparent 1254×1254 canvas. Runtime placement is
always `x: 0`, `y: 0`, `scale: 1`, and `rotation: 0`; alignment is baked into the files.
The attack animation uses three ordered frames at 105 ms per frame.

## Runtime layer order

1. wings
2. weapon
3. base
4. hair
5. outfit
6. shoes
7. arms
8. hat

The weapon sits behind the base so the existing hand covers its grip in the idle pose.
During an attack, the base, Azure arm pieces, Azure shoes, and Azure sword switch to their
matching frame. Hair, outfit, and wings remain independent overlays and reuse their idle
art when they do not define an attack sequence.

## Equipment mapping

- `helmet` -> `hat`
- `chest` -> `outfit`
- `gloves` -> `arms`
- `boots` -> `shoes`
- `weapon` -> `weapon`
- `wings` -> `wings`

Azure visuals are selected from `setId === "azure"`, with the item name as a compatibility
fallback for older saves. Any equipped wings currently select the angel-wing prototype.

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

Attack additions are staged at:

```text
sprite/characters/hero001/animations/attack/hero_attack_[0-2].png
sprite/characters/hero001/equipment/attack/arms_azure_attack_[0-2].png
sprite/characters/hero001/equipment/attack/shoes_azure_attack_[0-2].png
sprite/characters/hero001/weapons/attack/sword_azure_attack_[0-2].png
```

The Azure helmet uses `x: 75`, `y: -50`, and `scale: 0.88`, and is reused across
Idle and all three Attack frames. The death frame is not part of this candidate.
