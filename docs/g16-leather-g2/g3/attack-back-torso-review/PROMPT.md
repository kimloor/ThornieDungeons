# Rear torso donor generation

Mode: built-in ImageGen edit, transparent_background=true. One independent call for each of Attack_02 and Attack_03; no whole-body generation.

Inputs:
1. EDIT TARGET: attack-review-pack-v1/exports/<frame>/torso_armor.png cropped [220,360,440,580] and uniformly enlarged to 1024×1024.
2. FACING REFERENCE: current manifest-selected Azure torso_armor for that frame, identical crop/enlargement. Azure colors/design are not copied.
3. POSE CONTEXT ONLY: Attack_02 current assembled image at the same crop/enlargement; Attack_03 current full 768×768 assembled image. No generated context body pixels are admitted to equipment.

Shared prompt (with target frame appended):

Use case: precise-object-edit. Image 1 is the EDIT TARGET: isolated brown leather torso armor, fixed crop and framing on a 1024x1024 transparent canvas. Image 2 is the Azure TORSO FACING reference only. Image 3 is pose/context reference only. CRITICAL CORRECTION: this torso is viewed from a THREE-QUARTER REAR angle, the character's BACK faces the camera while the head turns right. Image 1 wrongly shows a front chest with front clasps and a front belt buckle. Replace ONLY the visible torso surface with the BACK of the same brown Leather armor design. Show a broad uninterrupted brown leather BACK PANEL with a subtle stitched center-back seam and rear shoulder/side construction, narrow antique-gold piping matching the existing set. Remove BOTH center-front gold chest clasps completely; no front buttons, no lacing, no breastplate opening. Replace the center-front belt buckle with a continuous plain rear leather belt; any small side fastening belongs at the far right side, never centered on the exposed back. Make the lower leather skirt/waist panels look like the REAR surfaces of the same armor. Keep the exact current neckline/armhole silhouette, two shoulder positions, belt height, torso outline, size, perspective footprint and position from Image 1. Preserve brown texture and existing gold palette; do NOT copy Azure blue/silver shapes or redesign the equipment tier. Do not add neck skin, head, face, arms, hands, trousers, sword, labels or background. Do not mirror the front image. Output ONLY the isolated rear-facing Leather torso armor, same crop/framing/scale, transparent background. The complete body pose is accepted and MUST NOT be changed. Target frame: <frame>; match the rear torso turn shown by its Azure reference.

Raw donor dimensions and hashes are in VALIDATION.json. build.py admits donor RGB only with the exact pre-existing per-pose alpha footprint. The remaining 19 exported PNGs are copied byte-for-byte.
