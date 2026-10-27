# G16 Idle 01 — Owner red-line overlap completion

Status: G16 G2 — OWNER VISUAL APPROVAL PENDING.

Reference: Owner-annotated download.png compared with the previous
G16_WEAPON_FREE_G2_ASSET_SHEET. This request authorizes completing hidden
equipment insertions, with foreground layers covering the additions.

Changes:
- Helmet: cut away the far-side narrow cheek strip below the marked brow;
  remove its detached endpoint. Main helmet pixels and placement preserved.
- Torso: complete small collar/back-neck, shoulder underside and armhole
  edge allowances using generated same-design edge material beneath the
  existing artwork. Preserve the original approved chest interior.
- Trousers: replace pointed/notched upper cut with full continuous waistband
  and hip insertion section. Original pixels from source Y=515 downward
  (knees and boots) are byte-identical to the prior exports.
- Both sleeves: add rounded upper-arm insertion caps and join the additions
  to the original sleeve cross-section. Original lower arm/glove pixels
  below Y=436 (arm_rear) / Y=449 (arm_front) are byte-identical to prior exports.
- Sword unchanged. Shared underlay remains entirely transparent.

Method: built-in ImageGen completion for four individual pieces, normalized
as full canvases; generated material restricted to upper insertion regions
or a small torso edge band. Existing lower art is restored exactly. Only
the new upper sleeve cross-sections are registered to meet the unchanged
lower sleeve. No Base, glove, knee or boot pose redraw.

Occlusion analysis:
Current runtime draws chest before both arm layers, and trousers after
chest. It will NOT automatically hide these new upper sleeve/waist additions.
The authoring preview therefore tests the proposed order:
Base -> legs_boots -> arm_rear -> arm_front -> torso_armor -> helmet -> sword
-> copied right-hand occlusion pixels. This is NOT deployed runtime behavior.
qa/current_contract_order.png preserves the existing-contract comparison;
qa/ORDER_COMPARISON.png displays old/current/proposed side by side.

VALIDATION.json measures actual added pixels hidden/visible in the proposed
composite. Most sleeve/waist insertions are hidden, not literally every added
pixel. Small visible seam/silhouette extensions remain for Owner review.
The completed torso edge is intentionally visible. No exhaustive mixed-set
visual QA or Production PASS is claimed.

Each seven-path export is 768x768 RGBA at origin (0,0), with no baked runtime
Y offset. Blue-added/red-removed masks and enlarged piece views are in qa/.
Artwork completion and proposed depth order require Owner review; runtime
order/slot/backward compatibility requires DEV approval before publication.
No source/runtime/manifest/R2/Production changes in this turn.
