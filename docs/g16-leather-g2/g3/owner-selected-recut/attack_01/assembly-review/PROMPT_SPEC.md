# Built-in ImageGen prompt specifications

Input for each sequential isolated extraction: ../step-01-helmet/owner_source.png. Transparent background requested. Same original pose, colors, leather detailing, original canvas scale/location; no skin, unrelated equipment, shadows, labels or checkerboard.

1. legs_boots_raw: extract trousers and both knee guards/strapped boots, preserve bent-leg pose; remove belt/skirt; complete continuous trouser waist insertion without V notch or spike.
2. arm_rear_raw: extract only raised anatomical right arm at image-left, closed glove/brass-edged bracer/bent sleeve; remove helmet and ALL shoulder plates; complete rounded closed upper sleeve insertion cap, no open cut or fragments.
3. arm_front_raw: extract only opposite open-gloved arm at image-right, preserve gesture and bracer; remove torso/shoulder plate; complete rounded closed upper sleeve insertion cap.
4. seam_cleanup_raw: target the actual assembled preview, fix only underarm seam around [289..315,438..493] and exposed skin in opposite sleeve/glove around [420..516,460..526]. Preserve all other pose/artwork. Only bounded equipment masks enter the exported pieces, not the generated full-body rendering.

Raw generation enlarged extracted parts, so whole pieces were uniformly registered offline using source-relative positions; see script and VALIDATION.json. No Base/limb deformation. Review, not automatic approval.
