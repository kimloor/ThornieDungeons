# Approved equipment publication

Robot and Skeleton revision-r2 are staged under `r2-upload/hero/v5/g2/equipment/{robot,skeleton}/`, with 112 frame layers, two upright sword masters and six contract/validation/publication records. The production manifest adds `assets.hero001.v5.g2.equipment.robot` and `.skeleton`. Existing manifest entries are unchanged.

These paths are reserved for future items; no items, runtime, gameplay or frontend changes are included. Full-face helmets require both hair layers hidden; this is declarative metadata pending runtime support. In-game QA is not complete.

The approved revision-r2 patches supersede the original candidate ZIP and earlier GIFs. The staging PNGs and their SOURCE_VALIDATION.json hashes are the publication source of truth. Native canvas placement is (0,0), matching the approved composites and Azure; erroneous candidate contract [0,7] metadata is corrected without moving pixels.

Publishing uses the normal main-branch R2 workflow with per-object download/SHA256 verification. Check that workflow before claiming R2 completion. Wing concepts are separate mockups and are not part of this release.
