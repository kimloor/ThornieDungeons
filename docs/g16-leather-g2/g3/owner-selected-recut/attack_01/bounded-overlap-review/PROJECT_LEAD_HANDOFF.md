G16 G3 — ATTACK_01 BOUNDED OVERLAP EXPERIMENT / OWNER VISUAL REVIEW PENDING
Branch: art/g16-g3-leather-frames | Existing Draft PR #160
Evidence: docs/g16-leather-g2/g3/owner-selected-recut/attack_01/bounded-overlap-review/

Result: preserved latest helmet placement, complete sword and all 7 export byte streams; tested offline shoulder/waist visibility masks and actual merged Leather resolver separately. Masks reveal chest skirt/shoulder plates, but raised-shoulder ring remains unresolved. Runtime fixture shows helmet overlapping raised bracer outside proposed hand crop [278,282,65,58]. No visual acceptance or runtime readiness claimed.
Checks: 7/7 768×768 RGBA/origin0, transparent underlay reason, clean canvas edges, SHA read-back; 28 protected Idle PNGs unchanged; 8 Base PNGs, runtime, manifest and selected Azure sword identical to latest main. No runtime/R2/production changes.
Next: Owner inspects ORDER_AND_MASK_COMPARISON.png, DETAILS.png and BASE_SOURCE_OVERLAY.png. Resolve shoulder source boundary and helmet/bracer treatment; report any required larger hand pass/order change to Project Lead before implementation. Attack_02/03 and Death_01/02 wait for prototype acceptance. G3 NOT DONE; G4 NOT READY.
