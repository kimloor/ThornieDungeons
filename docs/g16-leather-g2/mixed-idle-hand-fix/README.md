# Mixed equipment idle pants occlusion — 1.1.32

Owner screenshots reproduced using the actual manifest and runtime layer selection.
With a Leather sword and no supported glove family, right_hand_occlusion copied
Base pixels across the entire 768px width. The shared glove crop included Base
pants, overwriting equipped legs. Full Leather used arm_rear instead and was unaffected.

Base-only idle hand crops now cover x=244..291, with y=493/481/489 and height=42.
Bare-hand crops take precedence over Leather glove metadata. Gloved composition,
Attack/Death crops, approved artwork, manifest and R2 objects are unchanged.

Validation: 99/99 targeted tests passed (G16 compatibility, Skeleton visual,
W8 preview, Phaser architecture, Inventory). The eight approved full Leather
composites remain pixel-identical in the compatibility test. Before/after
reassembly reproduces and removes the gray pants overlay for Leather legs and
mixed Azure legs/Skeleton chest. Regression checks cover all four leg families
in all three idle frames. Build and diff whitespace checks passed.

Release: frontend 1.1.32; Owner device visual acceptance pending. Reload the game
before checking mixed equipment with a Leather sword and unsupported/empty gloves.
