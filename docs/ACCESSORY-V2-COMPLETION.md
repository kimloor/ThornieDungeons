# ThornieDungeons — Accessory V2 Completion

Status: **APPROVED / LOCKED FOR IMPLEMENTATION — PRE-V1.1.0 GATE B.5**
Risk: **HIGH — reward/inventory authority; feature branch + QA required**

This contract completes and replaces the unfinished generic Dungeon Accessory implementation before Ver 1.1.0. It does not redesign Mythic Set Accessories or unrelated Raid reward families.

## 1. Tier identity and base stat

Generic Accessory is one equipment slot. It has **flat HP** as its only base stat. Crit Chance, Crit Damage and Dodge are not base Accessory stats.

| Tier | Floors | Identity | Rare base HP |
| --- | --- | --- | ---: |
| T1 | 1–30 | Adventurer Charm | 40 |
| T2 | 31–50 | Bronze Amulet | 52 |
| T3 | 51–70 | Enchanted Amulet | 68 |
| T4 | 71–90 | Platinum Talisman | 88 |
| T5 | 91+ | Dragonheart Amulet | 114 |

Apply the existing Reward V2 rarity multipliers to base HP: Rare ×1.00, Unique ×1.15, Elite ×1.30. Round stored/displayed HP to a whole number using the normal stat boundary.

Reference Elite +0 HP is approximately T1 52 / T2 68 / T3 88 / T4 114 / T5 148.

## 2. Refine

Player-facing terminology changes from **Enhance** to **Refine**.

Generic Accessory supports Refine +0 through +10. Each Refine level increases its flat HP using the existing Reward V2 equipment growth of **+6% of base stat per level**. +10 therefore contributes 160% of the +0 HP value.

Use the existing success rates, Tier economy, Iron cost, Gold cost, downgrade behavior and Protection Stone behavior. Do not create Accessory-specific Refine materials or rates.

Internal compatibility names such as `enhanceLevel` may remain unchanged during this gate. This terminology change does not require a persistence-field rename.

## 3. Enchant

Player-facing terminology changes from **Empower** to **Enchant**. Internal compatibility fields such as `empowerSlots` may remain unchanged during this gate.

Capacity remains rarity-based:
- Rare: 1 Enchant
- Unique: 2 Enchants
- Elite: 3 Enchants
- Mythic: 4 only for separately approved Mythic sources; generic random Accessory cannot be Mythic.

Generic Accessory Enchant pool:
- HP%: +1 / +2 / +3%
- MP%: +2 / +3 / +4%
- Crit Chance: +1 / +2%
- Crit Damage: +2 / +3 / +4%
- Dodge: +1 / +2%
- STR: +1
- VIT: +1
- AGI: +1
- DEX: +1
- LUK: +1

Preserve the existing approved probability distributions for existing option types. Dodge uses the same 75% low / 25% max distribution as Crit Chance.

**Duplicate Enchant option types are allowed.** Do not add a no-duplicate rule.

New item instances roll their Enchant options independently. Existing V2.1 Lock/Reroll behavior remains: option type is fixed after item creation and Reroll changes only the numeric value of unlocked options.

## 4. Dungeon acquisition

Normal monsters: **0% Accessory drop**.

Elite encounter floors ending in 5: **2% separate Accessory roll**.

Chapter Boss floors ending in 10: **3% separate Accessory roll**.

The 2%/3% Accessory roll is separate from the generic equipment roll and must not reduce normal Weapon/Armor drop probability. Random Accessory uses the current floor Tier and the normal approved Rare/Unique/Elite rarity authority. It cannot roll Mythic.

### Boss First Clear

Every Chapter Boss First Clear awards **one Elite Accessory, 100% guaranteed**.

Tier follows the current floor:
- F10 / F20 / F30 → T1 Elite Adventurer Charm
- F40 / F50 → T2 Elite Bronze Amulet
- F60 / F70 → T3 Elite Enchanted Amulet
- F80 / F90 → T4 Elite Platinum Talisman
- F100 / F110 → T5 Elite Dragonheart Amulet
- later Boss floors follow the normal Tier mapping unless a future Tier contract supersedes it.

Every First-Clear reward is a newly generated item instance and independently rolls its Enchant options. Multiple rewards in the same Tier are intentional. Independent RNG may coincidentally produce the same combination; no forced uniqueness between floors is required.

The guaranteed First-Clear item is separate from the Boss's normal 3% Accessory roll.

## 5. Shop, Salvage and crafting boundaries

Generic Accessory is **not sold in the normal Main Shop** for this pre-V1.1.0 contract.

Generic Rare/Unique/Elite Accessory uses the normal V2 Salvage table by rarity. Refine Gold/Iron/Protection Stone and Enchant Gold/Mana Ore previously spent are not refunded by Salvage.

Do not reinterpret Mythic Set Accessory crafting, Raid milestone Accessory rewards, or other explicitly source-specific special-item contracts as generic Dungeon Accessory without a separate approved change.

## 6. Inventory / Compare / Blacksmith presentation

Display identity, Tier, rarity and Refine level normally, for example `Dragonheart Amulet +7`.

Present the flat HP contribution (including Refine) as the primary item stat. Present Enchant options separately so the player can distinguish base/refined power from build rolls.

Generic Accessory participates in Refine, Enchant and Salvage UI flows.

Player-facing Blacksmith terminology for this contract is **Refine / Enchant / Salvage / Craft**. Do not require an internal API/schema rename merely to change presentation wording.

## 7. Graphics contract

Create one production item icon for each generic Tier identity:
1. Adventurer Charm — simple starting adventurer charm.
2. Bronze Amulet — bronze/metal identity.
3. Enchanted Amulet — steel with a magical gem.
4. Platinum Talisman — platinum/high-tier magic identity.
5. Dragonheart Amulet — dragon scale / dragon crystal identity.

Accessory has **no Hero V5 wearable visual layer requirement** in this gate.

When the generic T1–T5 equipment art sets are produced one Tier at a time, include the matching Accessory icon in that Tier's item-icon family and review it with the set.

## 8. Cutover and authority

Project Lead confirmed that no Production-owned generic Dungeon Accessory needs preservation from the unfinished path because the Dungeon battle/reward path had not been available for players to obtain these items before this cutover. Therefore no player-owned Accessory migration/audit script is required for Gate B.5.

Replace the old placeholder generic Accessory identities and utility-base-stat generation directly. Do not add a destructive migration solely for those placeholders.

Implementation touches reward/inventory authority and is therefore HIGH risk:
- use a feature branch;
- preserve server-authoritative reward generation and inventory capacity/overflow behavior;
- keep settlement/idempotency guarantees;
- add focused tests for T1–T5 HP generation, rarity scaling, Refine, Enchant pool including Dodge, duplicate Enchants, Elite 2%, Boss 3%, First Clear guaranteed Elite, no Normal drop, no random Mythic, and separate-roll behavior;
- QA is required before merge/deploy.

## 9. Terminology migration boundary

From this contract onward, new player-facing design/docs should use:
- **Refine** = former Enhance (+0..+10 base-stat progression)
- **Enchant** = former Empower (rolled bonus options)

Older historical documents/code identifiers may retain their legacy names where renaming would create unnecessary compatibility risk. WAVE 3 Blacksmith + Crafting Redesign may audit broader internal terminology separately.
