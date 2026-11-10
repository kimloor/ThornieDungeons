# Built-in ImageGen edit prompt and input provenance

Mode: built-in ImageGen, transparent_background=true. No CLI/API fallback.
Input 1 edit target: neckline-fit-study/torso_armor_TRIAL.png, crop [256,352,512,608], enlarged uniformly to 1024×1024.
Input 2 anatomical fit reference only: neckline-fit-study/reassembled_TRIAL.png, same crop/scale. Generated reference body pixels are never admitted to the equipment export.

Prompt:

Use case: precise-object-edit. Image 1 is the EDIT TARGET: isolated brown leather chest armor on a transparent 1024x1024 canvas. Image 2 is ANATOMICAL FIT REFERENCE ONLY, do not output a dressed character. Edit Image 1 only: finish the freshly cut LOW OPEN NECKLINE with a thin continuous gold piping rim and smooth matching brown leather edge. The current neckline goes diagonally down from behind the tall image-left shoulder toward the front central gold fastener, then rises toward the small image-right shoulder. Retain exactly that LOW opening and its coordinates so the ORIGINAL NECK from Image 2 can show through it. Make the narrow edge neat and natural. Do not add a standing collar or tall hollow tube. Do not add neck skin, head, body, arms, face, white undershirt, labels or background. Keep the chest armor, tall left shoulder, small right shoulder, leather texture/colors, clasps, belt, buckle and skirts at exactly the same coordinates and scale as Image 1. Keep all material below the neckline and both shoulders unchanged. Output ONLY isolated chest armor, same framing on 1024x1024, genuinely transparent background.

The tool returned 1280×1280 and changed wider armor detail; that wider regenerated art was rejected for use. Only the bounded neckline donor pixels were admitted as documented in build.py. All six other exports and chest pixels outside the recorded region are verified unchanged.
