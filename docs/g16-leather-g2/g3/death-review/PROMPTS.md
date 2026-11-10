# Bounded ImageGen edits — Death_01

Built-in ImageGen, transparent background, one isolated part per call. No CLI/API fallback. Full original donors and input images are retained in masters/. None is accepted artwork. Canvas normalization is uniform per supplied crop: legs [350,430,550,630], anatomical right arm [260,370,410,520], anatomical left arm [430,360,570,500]. All final exports retain the full 768×768 origin. Only material RGB is admitted; see DONOR_ADMISSION.json and build.py. No donor anatomy or whole-Hero generation is admitted.

## Legs

Inputs: `legs_pose_target.png` (edit target), `legs_design_reference.png` (approved design). Output: `legs_material_donor.png`.

Use case: precise-object-edit. Isolated game equipment legs only. Image 1 is the EXACT pose and canvas registration target: backward-falling bent knees, left boot pointing down, right boot pointing right. Image 2 is the approved Leather material/design reference, NOT a pose. Dress ONLY the trousers and boots of image 1 in exactly image 2's dark brown cloth trousers, round brown leather knee pads with small brass rivets, layered brown leather shin wraps and dark leather boots with toe panels. Preserve image1 hip, knees, ankles, foot tips, silhouettes and canvas origin exactly; no translating, lengthening, recentering or posing legs. Paint equipment material onto the original legs. Remove the small white shirt and unrelated hand at top; no hand, skin, torso or weapon in result. Complete continuous waistband at top in the original waist position. Keep the same generous transparent margins and exact image1 placement. Clean outlined fantasy cartoon rendering matching image2, restrained brown/gold palette. Output ONLY isolated trousers and two boots on actual transparency; no text or shadow.

## Anatomical right arm / arm_rear

Inputs: `right_arm_pose_target.png` (edit target), `right_arm_design_reference.png` (approved design). Output: `right_arm_material_donor.png`.

Use case: precise-object-edit. Image1 is EXACT isolated right arm and relaxed OPEN hand edit target, position/pose/silhouette lock. Image2 is approved Leather sleeve/bracer/glove material and design reference ONLY. Dress image1 in image2 dark brown cloth sleeve from rounded upper-arm cap to elbow, brown leather bracer with gold outline, one rivet and small side buckle, and dark brown leather glove. Preserve EXACT elbow, wrist, palm, thumb and four RELAXED SEPARATE FINGERS, pointing down exactly as image1. Never use the closed fist of image2. Do not move, lengthen, recenter, rotate or redesign anatomy. Cover ALL skin in opaque leather or cloth. Complete the rounded sleeve insertion cap at shoulder; no shoulder armor, no white shirt, no skin, no torso, no sword. Same outline cartoon rendering and dark brown/gold Leather palette as image2. Keep image1 exact canvas composition and margins, transparent background. One isolated dressed arm only, no text.

## Anatomical left arm / arm_front

Inputs: `left_arm_pose_target.png` (edit target), `left_arm_design_reference.png` (approved design). Output: `left_arm_material_donor.png`.

Use case precise-object-edit. Image1 EXACT isolated left arm and slack curled fingers pose/canvas target. Image2 ONLY approved Leather design reference. Dress image1 with dark brown cloth upper sleeve, gold outlined brown leather wrist bracer with rivet and strap, dark brown leather full-finger glove. Keep EXACT image1 shoulder/elbow/wrist/fingertip locations, anatomy, angle, silhouette and placement. Preserve its loosely curved fingers pointing down and right. No fist, no extra fingers, no posing. Cover all skin; remove white shirt remnants; complete hidden upper sleeve insertion at top left. One isolated equipment arm ONLY, no body, no hand skin, no shoulder armor, no sword. Match image2 fantasy outlined rendering and restrained brown/brass palette. Transparent background, exact image1 canvas composition/margins, no labels.
