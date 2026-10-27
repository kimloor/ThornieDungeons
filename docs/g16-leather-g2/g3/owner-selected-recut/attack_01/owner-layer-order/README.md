# Attack_01 — Owner-specified layer order

Status: OWNER VISUAL ACCEPTANCE PENDING. Risk LOW, offline composition only. Latest main 7ef31753b969386d2750857dddaa53d44c03081c; branch parent 6d52c2ca6c6c1e792c0ec1916ed8a01db42dc83c. Mandatory master/pipeline read; references unchanged.

Owner supplied FRONT to BACK:
1. Anatomical right raised sword arm (`arm_rear` in current Leather files)
2. Complete sword
3. Helmet
4. Chest/shoulder armor
5. Anatomical left extended arm (`arm_front` in current Leather files)
6. Legs/trousers/boots
7. Hero Base

The compositor draws this exact sequence in reverse. Fully transparent coverage_underlay remains preserved in the source exports and makes no visible difference. Full original arm layers are used; no masks, cropped hand, extra torso pass, transformations or artwork changes. Latest helmet placement and independent complete sword retained.

Review REVIEW.png, reassembled.png and COMPARISON.png (previous Azure anatomical order versus Owner order). This is explicitly the Owner's proposed offline order, not Azure order or the current merged Leather runtime. No runtime, slot mapping, approved Idle bytes, Base/Azure, R2 or production manifest changes. G3 remains incomplete and artwork acceptance pending.

Reproduce from repository root: python docs/g16-leather-g2/g3/owner-selected-recut/attack_01/owner-layer-order/build.py

Project Lead handoff: PR #160 updated with exact Owner-order Attack_01 assembly; inspect current REVIEW.png. Seven original source exports remain intact. Runtime compatibility requires separate review if this order is visually accepted. Do not expand remaining poses or publish assets on this checkpoint alone.
