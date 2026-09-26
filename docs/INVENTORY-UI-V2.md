# Inventory UI V2 — Redesign Specification

Status: DESIGN LOCK / IMPLEMENTATION REFERENCE

This document defines the approved Inventory / Equipment redesign direction for ThornieDungeons.

The goal is to simplify the current Inventory screen, improve mobile readability, prepare for Safe Area + responsive breakpoints, and make equipment comparison/reward overflow behavior explicit without changing unrelated gameplay systems.

## 1. High-level direction

- Use the same default authenticated-game background style as Main Hub.
- Use the normal game header/currency presentation. Do not duplicate a separate currency row inside Inventory.
- Remove Quick Slots from Inventory. Quick Slots belong to Combat only.
- Remove the persistent item-detail panel from the bottom of the Inventory page.
- Remove duplicate bottom close controls if the page already has the standard close/back control.
- Item/equipment details open in a popup/modal when the player taps an Equipment slot or Inventory item.
- The layout must be compatible with the global Safe Area + responsive breakpoint work planned for the same implementation batch.

## 2. Equipment Area

Approved slot layout:

```text
Helm                 Gloves
Armor                Weapon
Boots                Accessory
Wings

      Hero sprite behind slots
```

Rules:

- Hero is the visual background layer of the Equipment Area.
- Equipment frames/cards render above Hero.
- Hero may overlap/extend behind Equipment slots; this is allowed and preferred over shrinking the character excessively.
- Hero visual layer must not block interaction with Equipment slots (`pointer-events:none` or equivalent presentation behavior).
- Equipment slots must remain the interactive foreground layer.
- Equipment slot tap opens the Item Detail popup immediately.
- No repeated helper text such as “tap for details” is needed inside every slot.
- Empty slots use a neutral/simple frame.
- Equipped items use rarity styling appropriate to that item.
- Equipped items appear only in Equipment slots and MUST NOT be duplicated in the Inventory grid.

## 3. Inventory Area

Initial capacity: **30 real slots**.

Default compact presentation on mobile:

```text
Inventory 18/30                 [Filter] [Sort]

[ ][ ][ ][ ][ ]
[ ][ ][ ][ ][ ]

          [ View All ▼ ]
```

Rules:

- Default collapsed Inventory shows 2 rows.
- Mobile baseline: 5 columns, therefore 10 visible slots while collapsed.
- `View All` expands the Inventory downward to show the remaining slots/items.
- Expanded state provides a collapse control.
- Tablet/desktop column count may increase as part of responsive implementation, but the same information hierarchy remains.
- Inventory count represents actual carried Inventory items/slots, not equipped items.
- Items currently equipped are excluded from Inventory-grid counting/presentation.

### Inventory cell presentation

Keep cells visually compact. A cell may show:

- item icon;
- rarity frame/accent;
- `+Enhance` indicator at the top-right when enhance level > 0;
- stack quantity `xN` at the bottom-left for stackable items.

Do NOT add:

- Equipped marker (equipped items are not present in this grid);
- Favorite/Lock star in the grid;
- verbose item name/type text inside every cell.

## 4. Filter

Current item count is small, but Filter is retained for future growth.

Filter owns detailed classification controls rather than cluttering the Inventory header.

Filter should support, as applicable:

- Category: All / Equipment / Consumable / Material-Junk;
- Equipment Type / slot;
- Rarity;
- Enhanced / Not Enhanced;
- Enchanted / Not Enchanted.

Future filters such as Level, Set, Element, etc. may be added inside the same Filter popup without changing the main Inventory layout.

## 5. Sort

The visible `Sort` control is NOT a dropdown for viewing by rarity/type/value.

Tapping `Sort` performs a real deterministic Inventory reorder.

Recommended ordering:

1. Equipment
2. Consumable
3. Material / Junk

Within a category:

1. higher rarity first;
2. higher Enhance first;
3. stable deterministic fallback order.

The exact stable fallback key may follow existing item identity/order data, but repeated sorting must not randomly reshuffle equal items.

## 6. Item Detail Popup

Use one Item Detail popup system for both Inventory items and equipped items.

Popup contents may include:

- item icon/art;
- item name;
- `+Enhance` level;
- rarity;
- type/slot;
- item level / requirement if available;
- stat/effect details;
- context-appropriate actions.

The popup must be mobile-safe. If content is taller than the viewport, scroll the popup content while keeping important actions accessible.

## 7. Favorite / Lock

Favorite/Lock uses a small star in the Item Detail popup.

Recommended interaction:

- `☆` = unlocked/not favorite;
- `★` = locked/favorite.

A locked/favorited item cannot be sold or salvaged until unlocked.

Do not show the star in the Inventory grid.

## 8. Equipment Comparison

When the player taps an unequipped Equipment item in Inventory and there is a compatible Equipment slot, the popup displays a horizontal current-vs-new comparison.

Approved comparison header direction:

```text
[ICON] Azure Blade +7   >   [ICON] Dragon Fang +8
       Lv.40 • Enchanted     Lv.45 • No Enchant
```

Header requirements:

- current equipped item on the left;
- item currently being inspected on the right;
- mini item icon on both sides;
- item name;
- `+Enhance` level;
- item level if available;
- enchant state only as a simple boolean presentation: `Enchanted` / `No Enchant`.

Do NOT duplicate individual enchant-option details in the comparison header. Those effects belong in the calculated stat comparison below.

If the target slot is empty, the left side becomes an Empty Slot presentation.

If the player is inspecting the item that is already equipped, no current-vs-new comparison is required; show normal item details.

## 9. Stat Comparison

Comparison must use the **final calculated result**, including base item stats, Enhance, Enchant options, and other item-derived values that affect the displayed character stats.

Example:

```text
ATK      520  >  548    +28
DEF      310  >  298    -12
CRIT      12% >   15%   +3%
CP       2840 >  2912   +72
```

Rules:

- Prefer showing stats that actually change.
- If an old item has an Enchant option and the new item does not, losing that option must appear as a negative delta.
- If the new item has an Enchant option and the old item does not, gaining that option must appear as a positive delta.
- If both items have different Enchant options, compare the final resulting values rather than comparing only base item data.
- CP delta may be shown if it can be calculated consistently from the real character-stat pipeline.

### Delta colors

Use the same visual language as the current Character Status allocation preview:

- positive / increase = **cyan**;
- negative / decrease = **red**;
- neutral/default information = white/gray;
- do not rely on color alone: always show explicit `+` / `-` signs.

## 10. Popup actions

For an unequipped Equipment item:

- primary action: Equip;
- secondary actions as applicable: Sell / Salvage.

For an equipped item:

- primary action: Unequip;
- selling/salvaging should require the item to be unequipped first.

For Material/Junk/other non-equipment items:

- no Equipment comparison;
- show only relevant actions/details.

Protected/locked items must disable Sell/Salvage.

High-rarity and/or enhanced items should require confirmation before destructive actions such as Sell/Salvage unless separately protected by an existing stronger rule.

## 11. Rarity Visual System

Use one rarity language across Inventory cells and Item Detail popup, with a stronger effect in the popup.

Suggested hierarchy:

- Common / normal Junk: white/gray;
- Rare: blue;
- Unique: purple;
- Elite: orange;
- Legendary/Mythic: gold.

Inventory grid:

- primarily rarity border/accent;
- only subtle glow where useful;
- avoid distracting continuous animation.

Popup:

- rarity border;
- rarity-colored item name/header accent;
- restrained outer glow;
- stronger visual emphasis at higher rarity.

Animation guidance:

- Common: no glow animation;
- Rare/Unique: preferably static/subtle;
- Elite/Mythic: optional very restrained pulse/glow only if readability is preserved.

Rarity styling must not conflict with stat-delta colors:

- rarity = frame/name/accent;
- positive stat delta = cyan;
- negative stat delta = red;
- normal information = white/gray.

## 12. Inventory Capacity

The previous Inventory UI displayed a maximum of 25 visible slots but did not consistently enforce that as a true item-capacity rule.

Inventory V2 changes this to a real starting capacity of **30 slots**.

Do not add Diamond-based slot purchasing in this redesign.

Future direction is a separate Storage/Warehouse system rather than monetized Inventory-slot expansion.

### Stackable items

- If a stackable Material/Junk item can merge into an existing stack, it may do so without consuming a new Inventory slot.
- If a new stack/new item would require another slot and Inventory is full, it must use Overflow handling below.

## 13. Overflow / Pending Loot

Items must never silently disappear because Inventory is full.

If a reward requires a new Inventory slot and Inventory is full:

- store the item/reward in persistent Overflow/Pending Loot;
- show an Inventory notification/badge when Overflow contains items;
- expose Overflow from the Inventory screen;
- allow `Claim` per item;
- allow `Claim All That Fits`;
- items that still cannot fit remain in Overflow.

Overflow must persist through save/cloud state and must not be session-only.

Example compact presentation when Overflow exists:

```text
⚠ Overflow 3 items                         [View]
Inventory 30/30                    [Filter] [Sort]
```

When Overflow is empty, hide this row.

Suggested future safety ceiling: a finite Overflow cap may be added, but implementation must never silently delete rare/high-value rewards. If such a cap is introduced, a clear player-facing resolution flow is required.

## 14. Future Storage/Warehouse

Future direction:

- Inventory = carried/active items;
- Storage/Warehouse = long-term reserve/collection items.

Because Storage is planned, Inventory V2 should NOT add a Diamond-based capacity-upgrade economy.

Storage is outside the current Inventory V2 implementation scope but the Inventory data/UI architecture should avoid blocking it.

## 15. Safe Area + Responsive Integration

Inventory V2 is intended to ship together with the global Safe Area + responsive breakpoint foundation.

Related responsive direction from Hero V5:

- Mobile: current ~430px-class layout;
- Tablet: ~600–700px-class layout;
- Desktop: ~700–800px-class layout or dedicated desktop composition.

Inventory-specific expectations:

- safe-area aware top/bottom interaction zones;
- no overlap with device notch/status/home indicators;
- use dynamic viewport sizing rather than assuming static `100vh` only;
- do not scale the entire mobile UI blindly on larger screens;
- Equipment Hero/slots, Inventory columns, popup width, and spacing may adapt by breakpoint while preserving the same interaction model.

A dedicated global responsive/safe-area spec may be created separately for reuse by all screens.

## 16. Related implementation-batch notes

The same upcoming UI implementation batch is also expected to address known Battle presentation issues:

- Combat speed button (x1/x2) not displaying;
- Pet sprite still clipping/falling outside the Battle presentation area.

These Battle issues are not part of the Inventory interaction contract itself, but they should use the same Safe Area/responsive foundation where relevant.

## 17. Scope boundary

Inventory UI V2 does NOT authorize:

- unrelated combat/balance changes;
- changing item stat values;
- changing Enhance/Enchant balance;
- adding the future Storage/Warehouse UI now;
- adding Diamond-based Inventory expansion;
- redesigning unrelated pages beyond what is necessary for shared Safe Area/responsive foundations.

Implementation should preserve existing gameplay/data behavior unless this document explicitly replaces it (notably Inventory capacity/Overflow handling and Inventory presentation behavior).

## 18. Optional Graphics manifest contract

Inventory V2 follows the existing camelCase `battleUi` / `petUi` convention. Every entry is
optional; CSS remains the runtime fallback until Graphics publishes it.

```json
{
  "inventoryUi": {
    "equipmentSlotFrame": "ui/inventory/equipment_slot_frame.png",
    "popupFrame": "ui/inventory/popup_frame.png",
    "mythicFrame": "ui/inventory/mythic_frame.png",
    "icons": {
      "filter": "ui/inventory/icon_filter.png",
      "sort": "ui/inventory/icon_sort.png",
      "expand": "ui/inventory/icon_expand.png",
      "favorite": "ui/inventory/icon_favorite.png",
      "overflow": "ui/inventory/icon_overflow.png"
    },
    "sectionOrnament": "ui/inventory/section_ornament.png"
  }
}
```

## 19. Future shared Phaser Hero preview boundary

The Inventory page remains React/DOM. A future roadmap milestone may replace only the central Hero visual preview with the shared Phaser HeroRenderer.

Approved boundary:

~~~text
Inventory React state
→ optional preview equipment state
→ EquipmentVisualResolver
→ HeroRenderer
→ HeroPreviewScene
~~~

Rules:
- Inventory grid, item popup/comparison, stats, filter/sort and actions remain DOM;
- Equip/Unequip/save authority remains in the existing application/data flow;
- previewing an item must not mutate authoritative equipment state;
- Hero preview reuses the same HeroRenderer used by Combat/Arena rather than creating an Inventory-specific renderer;
- approved Hero V5 equipment/wing frame contracts remain authoritative;
- small equip glow/transition may be presentation-only after the core preview is stable.

This is a future roadmap integration and does not change current Inventory V2 behavior by itself.
