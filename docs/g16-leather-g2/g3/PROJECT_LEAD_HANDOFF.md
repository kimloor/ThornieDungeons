# READY-TO-COPY PROJECT LEAD HANDOFF PROMPT

Role: Project Lead
Task: G16 G4 Final Publication Review / DEV Compatibility Assignment
Status: G4 OWNER FINAL VISUAL APPROVED — final GitHub asset publication; G5/G6 pending.
Repository: https://github.com/kimloor/ThornieDungeons
Existing Draft PR: https://github.com/kimloor/ThornieDungeons/pull/160
Branch: art/g16-g3-leather-frames
Accepted G3 source: 7c9d72d938a60cd1d363234bdb8a0905fb2d1f4c
Publication commit: use the exact new SHA recorded in PR #160 final G4 acceptance body (self-referential SHA is not embedded in this committed file).
Main checked: 614d8e363efa074d257319f3e3578a56196c2a06
Risk: LOW, authorized final artwork/docs publication only.

Owner APPROVED the corrected full-set contact sheet, seam/material comparisons and Idle/Attack/Death animation previews in ChatGPT, then explicitly authorized upload. No additional artwork changes authorized. Approval/package SHA is pinned in g4-source/OWNER_APPROVAL.md.

Published: exactly 11 approved existing equipment PNG replacements (Idle1–3 arm_front; Attack1–3 torso_armor; Death1 torso_armor/legs_boots/arm_rear; Death2 torso_armor/legs_boots), canonical 56-file VALIDATION.json/SHA256SUMS, final qa contact/comparison/animation files and 8 actual composites, essential bounded RGB donors/final admission masks/prompts/provenance, read-only QA validator and final documentation. No extra equipment export paths or history/evidence deletions.

QA PASS: 56/56 RGBA 768×768, fixed origin [0,0], clean canvas-edge alpha, transparent underlays/Death swords with emptyReason; 11 match approved package; 45 preserved SHA; 8 canonical Base SHA; exact Idle bob [0,-12,-4]; Death RGB repair piece alpha identical; all8 helmets/swords/underlays unchanged; Death2 helmet [0,-8] preserved; unchanged assembled nonzero-alpha silhouette support; all8 actual composites match accepted in-chat preview; contact/GIF/package members SHA/decode checks. Interior opacity may increase for seam coverage. No unresolved artwork defect after Owner acceptance. Offline animation timing is illustrative.

Evidence: docs/g16-leather-g2/g3/VALIDATION.json, SHA256SUMS, qa/FULL_SET_CONTACT_SHEET.png, qa/SEAM_BEFORE_AFTER.png, qa/MATERIAL_BEFORE_AFTER.png, qa/{idle,attack,death}_preview.gif, qa/*_composite.png, g4-source/OWNER_APPROVAL.md and SOURCE_PROVENANCE.json.
Verify: python docs/g16-leather-g2/g3/build_current_qa.py; from g3 directory run sha256sum -c SHA256SUMS. Old G3 builders/evidence are historical and must not overwrite final G4. CI: consult exact published-commit checks in PR; CI is separate from Owner artwork acceptance. No application source changed, so frontend generation is not required.

Remaining runtime incompatibilities: Attack1–3 and Death2 require foreground anatomical right arm (Leather arm_rear); existing leather_overlap_v1 may not reproduce approved Art Order. Attack per-frame post-sword hand crops unresolved: do not copy Idle crops or infer them from offline composites. Empty Death sword needs no post-sword crop. Existing reviewed Idle crop metadata remains declared. No actual runtime/fallback regression is certified.

Exact next action: verify published commit and CI, record G4 accepted, then issue a bounded DEV compatibility assignment against this pinned final asset ledger and documented art order. DEV must propose/review the compatibility solution, preserve existing families/slot/hair behavior and run actual renderer regression before G5 can pass. Production publication requires a separate G6 authorization.

Prohibited: keep PR #160 Draft; no new PR, merge, R2 upload, production manifest or runtime change, deploy, gameplay/economy/Worker/API/D1 change, further artwork edit, source/approval-evidence deletion, or G5/G6 PASS claim.
