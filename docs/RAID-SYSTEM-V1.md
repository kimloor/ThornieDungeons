# ThornieDungeons Raid System V1

Status: **ACTIVE — current Raid contract and implementation reference**

## 1. Purpose

This document is the central reference for Raid work. Read it together with `AGENTS.md`, `PROJECT-INDEX.md`, and the relevant backend/asset files before changing Raid behavior.

## 2. Scope

Raid is a separate game mode from normal Dungeon Battle. Changes to Raid must not silently alter normal Battle, Arena, save, economy, or authentication behavior.

When a Raid task affects shared combat rules, persistence, authentication, rewards, or assets, also read the matching active system document.

## 3. Current Raid bosses

The current production Raid boss IDs are:

| Boss ID | Display name | Base HP |
| --- | --- | ---: |
| `azure_angel` | Azure Angel | 150,000 |
| `robo_phoenix` | Robo Phoenix | 260,000 |
| `dark_dragonlord` | Dark Dragonlord | 420,000 |

Boss rotation uses the existing `spawnIndex` flow. HP scaling remains **+20% per spawnIndex** unless an explicitly approved task changes that rule.

Do not restore retired boss IDs such as `slime_titan`, `iron_golem`, or `shadow_wyrm` as active production bosses unless explicitly approved.

## 4. Boss visual contract

Raid boss visuals are manifest-driven and must be verified against `r2-upload/manifest.json` and the R2 object paths together.

Current manifest keys:

- `assets.raidBosses.azure_angel`
- `assets.raidBosses.robo_phoenix`
- `assets.raidBosses.dark_dragonlord`

Each current Raid boss uses:

- `idle`: 3 frames
- `hurt`: 3 frames

Do not infer or add attack/death animation requirements from normal monsters unless a new Raid visual contract is explicitly approved.

Asset path changes must update manifest references and all runtime lookups in the same scope. Do not guess asset keys or paths.

## 5. Persistence and participant data

Raid has dedicated persisted state. Historical schema includes Raid boss state and participant state, including fields for attempts, contribution, milestones, and settlement.

Historical migrations are not the lane for new schema work. Any future production D1 schema change must follow `DEPLOYMENT.md` and use a new forward-only migration under `migrations/auto/`.

Do not replay historical Raid migrations.

## 6. Auth and backend safety

Raid API calls must use the current authenticated session flow. Do not reintroduce legacy authentication patterns to make Raid requests pass.

Backend changes must preserve unrelated player, Raid, Arena, inventory, currency, and save data.

If a Raid change touches rewards, attempts, contribution, settlement, stamina, or persistence, treat it as high-impact and run targeted regression checks.

## 7. Change boundaries

A Raid-only task must not silently change:

- normal Dungeon combat rules
- Arena rules
- Hero/Pet balance
- global economy values
- shared save/auth contracts
- unrelated R2 assets

If shared behavior must change, report the dependency before implementing it.

## 8. Verification

For Raid changes, verify the relevant subset of:

- correct boss ID and display name
- boss rotation/spawnIndex behavior
- HP scaling
- participant attempts/contribution state
- reward/milestone/settlement behavior when touched
- authenticated API flow
- boss manifest key and R2 path
- idle/hurt animation loading
- no 404/fallback mismatch for changed assets
- no regression to normal Battle or Arena when shared code is touched

## 9. Maintenance

Update this document when an approved Raid production contract changes. Production code describes current implementation, but a code/spec mismatch must be investigated rather than silently redefining the intended Raid rules.
