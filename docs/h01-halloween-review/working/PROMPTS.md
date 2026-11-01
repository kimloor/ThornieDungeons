# Artwork specifications and offline authoring record

Mode: built-in imagegen, genuine transparent background requested for every artwork job. Final selected prompt specifications below describe the exact design constraints; review sheets are deterministic compositions of selected files, not regenerated Hero images.

## Gate — precise-object-edit

Input: current `r2-upload/ui/dungeon-select/dungeon-gate-boss-v2.webp` as edit target. Recolor only gold metal and luminous accents to deep amethyst with violet magical highlights. Preserve original architectural geometry, silhouette, proportions, canvas 1024×1536, spires, panels, central rune and dark stone. No new objects, pumpkins, labels, floor number, EVENT, annotation, background or redesign. Prototype only.

## Haloween nightmare — stylized-concept, followed by margin correction

One isolated left-facing idle of a hooded grim reaper visibly riding a skeletal horse and holding a prominent crescent scythe. Bone ivory, dark purple cloth, restrained violet highlights; clean stylized fantasy game rendering, open negative space between the scythe and horse head and between four skeletal legs. Transparent background. No scene, labels or additional views. Full subject, stable hooves, readable mounted silhouette. Revision: keep the same design and stance but leave transparent outer margins so the complete scythe and tail remain visible. No Attack or Death.

Selected full source: generated 1280×1280. Uniform resize to 704×704 and placement at (32,24) on 768×768, without alpha trimming or recentering. This is a single recorded authoring registration.

## Excaliburnt — stylized-concept, followed by stone-only correction

Upright complete mythic Excalibur-like sword, tip up, pommel down, 1024×1536 portrait, transparent. Long straight exposed silver double-edged blade, gold fuller and subtle purple runes, gold guard with amethyst, dark violet wrapped grip centered around (512,1250), gold pommel. Broken grey rock/pedestal remains attached only at the blade tip. No actual hammer class, axe, hands, Hero, background, text or separate weapon. Revision: enlarge ONLY the stone into a broken roughly rectangular pedestal chunk, visibly wider than the golden crossguard; retain blade, hilt, grip coordinates, orientation and long exposed blade. Selected result is the master; icon and wearable exports use identical artwork.

## Technical export commands

Weapon registration (ImageMagick):

```sh
convert EXCALIBURNT_MASTER_UPRIGHT.png -alpha on -virtual-pixel transparent \
  -define distort:viewport=768x768+0+0 \
  -distort SRT '512,1250 0.205 135 270,505' \
  PNG32:EXCALIBURNT_IDLE_01_WEAPON_ONLY.png
```

Icon-only export; trimming is restricted to this icon, never the wearable layer or Hero:

```sh
convert EXCALIBURNT_MASTER_UPRIGHT.png -trim +repage -background none \
  -rotate 40 -trim +repage -resize 448x448 -gravity center -extent 512x512 \
  PNG32:EXCALIBURNT_ICON_512.png
```

`prepare-review.cjs` assembles the actual exports over repository Base and manifest-selected Azure layers. The optional authoring hand crop is [240,475,60,65] from original Base and is placed at (240,475) unchanged, solely in the labeled hand-study composite. The weapon file is shared by all composites and contains no hand pixels. No runtime transform or offset 84 is baked into the frame.

## Owner revision 2

Change only the rock region and embedded blade tip: uninterrupted solid grey rock above the exposed blade, with no metal tip above the rock and no blade stripe across its face. Natural rounded irregular boulder, curved corners, not a rectangular block. Preserve remaining sword, grip coordinates, upright canvas and transparency. Gate and boss are Owner concept-approved and preserved unchanged.
