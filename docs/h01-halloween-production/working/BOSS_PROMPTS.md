# Boss frame authoring prompts

Mode: built-in imagegen edit, referenced image = locked `docs/h01-halloween-review/boss/HALOWEEN_NIGHTMARE_IDLE_01.png`, genuine transparent background requested. No new visual concept. Full selected source outputs are preserved in `boss-sources/`; `BOSS_SOURCE_FILES.json` maps frame names.

Shared constraints: exact approved purple hooded skull reaper mounted on the ivory skeletal horse, same ornate crescent scythe, armor/skulls/saddle, facing left, original square stage and scale, no trimming or independent recentering, transparent background, no scene, labels, ground disk, motion blur or duplicate weapon. Standing frames keep the four horse hooves at the reference footprint; scythe and cloak stay inside frame. Intentional Attack/Death articulation is distinct from unintended design/scale drift.

| Frame | Requested change from locked reference |
| --- | --- |
| idle_02 | Small breathing rise of reaper chest, cloak tips ripple inward 3–6 source pixels, scythe tilt at most 1 degree, horse head/skeleton/hooves essentially unchanged. |
| idle_03 | Exhale/return toward original; chest about 1 source pixel lower, cloak tips drift outward 3–5 pixels, scythe near original angle, hooves unchanged; loop back to Idle_01. |
| attack_01 | Wind-up: rider raises the same scythe toward upper-right, both hands grip shaft, horse remains standing, seated position/scale unchanged, blade entirely in canvas. |
| attack_02 | Strike toward left: rider leans slightly forward from same saddle, scythe sweeps left at about horse-head height with distinct silhouette, no horse translation or rearing. |
| attack_03 | Follow-through: scythe lowered diagonally to lower-left, clear of horse legs, rider recovers toward Idle, restrained trailing cloak, same horse footprint. |
| death_01 | Final defeated pose: same horse collapsed on folded skeletal legs, skull lowered facing left, rider slumped in saddle, same scythe laid on ground in front, same scale with expected transparent space above; no gore or extra effects. |

Technical normalization is full-canvas 1254×1254 → 768×768 at [0,0], not silhouette fitting. Alpha values 1–3 are removed as subvisible edge dust; source alpha >=4 is retained before resampling. Idle_01 is copied unchanged from the approved prototype. All original asset bytes are preserved in source lock/repository; no Hero anatomy was regenerated.
