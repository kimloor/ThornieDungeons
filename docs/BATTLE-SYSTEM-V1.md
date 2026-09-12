# Battle System V1 — Master Contract

Status: **approved gameplay/architecture source of truth for Dungeon Battle V1**.

This document collects the user-approved Battle V1 requirements for implementation. It owns **combat integration behavior**: turn flow, action resolution, shared statuses, Hero/Pet combat interaction, Battle UI behavior, checkpoint/resume, migration behavior, and reusable combat architecture.

Related source-of-truth documents remain authoritative for their own detailed catalogs/progression:

- `docs/HERO-SKILL-SYSTEM-V1.md` — Hero skill catalog, branch structure, rank/progression, skill-specific values not overridden here.
- `docs/PET-SYSTEM-V2.md` — Pet roster, progression, stat formulas, Pet skill catalog.
- `docs/CHARACTER-PROGRESSION.md` — character progression/UI contract.
- `docs/HERO-OVERLAY-V4.md` — Hero visual/overlay and Battle presentation contract.

If an older/TBD combat-integration note in those documents conflicts with a locked rule in this file, **this file wins for Battle V1**. Do not invent replacements for rules not covered here; report the conflict/unknown first.

---

## 1. Scope and goal

Battle V1 completes Dungeon combat using one reusable combat foundation:

- Combat Engine / round and action flow
- Hero Skill V1 integration
- Shared Status Engine
- Pet System V2 combat integration
- Battle presentation/UI behavior
- battle end/recovery
- checkpoint/resume and reward safety
- legacy save migration needed by this Battle update
- architecture reusable by future Raid and Arena modes

Out of scope:

- Arena/PvP implementation and PvP-specific control balance
- Raid redesign/new Raid mechanics
- final Pet graphics redesign
- Pet Gacha/economy rebalance
- Boss Floor encounter/reward redesign
- item-drop/loot-table redesign
- endgame balance pass
- offline Auto Battle

Boss Floor encounter rules and Loot/Reward systems will be specified separately later.

---

## 2. Architecture requirement — reusable combat core

Current Battle logic must not simply continue growing inside `src/ui/App.js`.

Refactor Battle gameplay logic into reusable combat modules so Dungeon, future Raid PvE, and future Arena PvP can call the same core instead of copying Hero/Pet/combat logic.

Recommended responsibility split (exact filenames may vary if DEV has a cleaner equivalent):

- combat core/engine — round, queue, action pipeline, battle outcome
- combat unit builders — Hero / Pet / Monster combat-unit creation
- shared status resolver — Poison / Stun / Silence / Armor Break / DEF Up / Status Resist / Boss conversion
- Hero actions — Basic Attack / Active / Potion / Flee
- Pet actions/AI
- special resources/triggers — Fury / Aegis / Scheme / passive/Keystone trigger rules
- checkpoint/serialization
- mode adapters — Dungeon-specific Flee/Skip now; future Raid/Arena can reuse core with their own mode rules

`App.js` should primarily orchestrate React state, presentation and UI bridging; gameplay rules should not depend unnecessarily on Dungeon UI components.

Normal play, Auto and Skip must use the **same combat resolver/gameplay rules**. Do not implement a separate estimated/shortcut battle formula for Skip.

Shared Boss/Raid/PvP-capable rules must be centralized whenever practical rather than duplicated per skill/unit/mode.

Refactor verification is technical (DEV/QA); user review focuses on in-game behavior rather than reading code.

---

## 3. Combat units and round-based Speed Queue

Combat units in Dungeon Battle V1:

- Hero
- one Active Pet, if equipped/alive
- living Monsters

At the start of each Round:

1. snapshot current Speed of all living units;
2. sort all living units from highest Speed to lowest;
3. every unit gets at most one Action that Round;
4. rebuild/recalculate the queue at the next Round.

Hero does **not** automatically act first.

High Speed does not grant extra Actions per Round in V1.

Tie-break behavior must be deterministic within the already-displayed queue for that Round so the Turn Order UI cannot disagree with actual resolution. The exact tie-break policy may remain implementation-defined if fair and stable for that queue.

Dead units are removed from future actions/queue previews.

---

## 4. Shared Action pipeline

Use one consistent action lifecycle. Exact internal function names/order may vary, but gameplay must preserve these semantics:

1. Action start
2. start-of-Action effects such as Poison
3. death check from start-of-Action effects
4. Stun/control check
5. choose/validate action
6. resolve targeting
7. hit/miss/crit/damage/heal
8. status proc and Boss/Raid conversion
9. passive/Keystone/special-resource triggers
10. cooldown/resource updates
11. duration/tick updates as applicable
12. post-Action trigger resolution (including Aegis at the required timing)
13. battle-end check
14. advance queue

Do not save a checkpoint in the middle of a multi-hit/status/trigger chain.

---

## 5. Hero commands

### 5.1 Basic Attack

- no SP cost
- no cooldown
- uses Accuracy / Dodge / Crit rules
- can trigger eligible Basic-Attack/on-hit/on-attack passives
- counts as a Hero attack Action
- Auto uses Basic Attack only

If the selected single target dies before the Hero action resolves, auto-retarget to the **living enemy with the lowest HP**.

AoE resolves against living targets at resolution time.

### 5.2 Active Skill

Hero can use only learned + equipped Active skills in the existing 4 Active slots.

Requirements:

- learned
- equipped
- cooldown = 0
- enough SP
- Hero not Silenced

If an attack skill misses, SP is still consumed and cooldown still begins normally.

### 5.3 Potion

Potion consumes one full Hero Action.

- Hero does not attack during that Action
- does not count as an attack/on-attack trigger
- Action-based status/cooldown progression still follows the Action as applicable
- Silence does not block Potion

### 5.4 No manual Skip Action

Battle V1 has no command that simply skips the current Hero Action. Hero turns must resolve through an action command or Stun/control.

---

## 6. Cooldown semantics

Hero and Pet use the same cooldown semantics.

Example CD 2:

- skill resolves -> cooldown becomes 2
- owner's next Action passes -> 1
- following owner Action passes -> 0
- then usable again

A Stunned unit that loses its Action still had an Action pass, so its cooldown ticks normally.

Global CDR safeguards:

- combined passive/Keystone CDR max **1 Turn per Action**
- an Action cannot reduce the cooldown of the same skill whose cooldown was newly created by that same Action
- passive/Keystone triggers max once per Action unless explicitly `per Hit`

---

## 7. Auto

Auto controls only Hero Basic Attack.

While Auto is ON:

- Hero automatically Basic Attacks each available Hero Action
- does not use Active Skills
- does not use Potion
- does not use Flee
- player can cancel Auto by toggling it OFF

Auto must turn OFF:

- when battle ends
- when resuming a battle after closing/reopening the game

Auto never continues fighting while the game is closed.

---

## 8. Flee

Flee consumes the Hero Action.

Formula:

`Flee Chance = 50% + (Hero AGI × 0.5%)`

Cap: **99%**.

Success:

- exit the Dungeon battle according to the normal Dungeon exit flow

Failure:

- Hero loses that Action
- queue continues normally
- show clear feedback such as `Escape Failed!`

Boss/Raid/Arena may prohibit or override Flee through mode rules later.

---

## 9. Skip Battle / fast resolution

Skip is a **finish-this-floor simulation**, not Skip Action.

Availability:

- hidden for Hero turns 1–5
- available starting on **Hero turn 6**

When pressed:

- resolve the rest of the current battle immediately using the same combat resolver as normal play
- Hero uses **Basic Attack only** for the rest of that simulation
- Pet and Monsters continue using their real AI/actions/queue/status/cooldown rules
- do not wait for presentation animations
- do not use a separate approximate win/loss formula

Result:

- Victory -> normal EXP / Gold / Drop / floor progression / rewards
- Defeat -> normal Defeat/Retry flow

UI should prevent repeated taps while resolution is running (for example a short resolving overlay/state).

---

## 10. Shared Status Engine

Hero, Pet, Monster, Boss and future Raid combat must use the same status resolver.

### 10.1 Poison

- ticks **before the poisoned target's Action**
- if Poison kills the target, it dies immediately and gets no Action
- reapply does not stack damage
- reapply refreshes duration
- strongest current Poison damage wins
- Hero- and Pet-applied Poison share one Poison slot per target

### 10.2 Stun

- target loses one Action
- after that lost Action, Stun is consumed
- no stack
- no extension
- Master Tactician cannot extend Stun
- Poison/start-of-Action effects resolve before the Stun prevents the Action

### 10.3 Silence

- blocks Active Skills only
- Basic Attack remains available
- Potion remains available to Hero
- reapply refreshes duration

### 10.4 Armor Break

- DEF -15%
- normal duration 2 Turns unless a specific approved effect says otherwise
- strength does not stack
- reapply refreshes duration

### 10.5 DEF Up

- Damage Taken -30%
- strength does not stack
- reapply refreshes/keeps the longer duration

### 10.6 Status Resist / proc order

Harmful statuses such as Poison/Stun/Silence/Armor Break use percentage-point subtraction.

Conceptual order:

`base proc + eligible bonuses + Scheme bonus -> global proc cap -> target Status Resist -> final proc chance`

Example: 59% before Resist against 20% Status Resist -> 39% final.

Boss conversion occurs only if the status proc successfully passes Status Resist.

Global control/status proc cap target remains **90–95%** where applicable.

---

## 11. Boss / Raid status conversion

Boss and Raid Boss do not receive hard control from Stun/Silence; successful procs convert instead.

Successful Stun proc:

- triggering hit becomes Critical

Important: if the Stun proc fails but the hit naturally rolled a Crit, the hit remains a normal natural Crit. Conversion never cancels natural Crit.

Successful Silence proc:

- triggering hit gains **30% DEF Pierce** for that hit

Poison and Armor Break work normally unless a later boss-specific override says otherwise.

Combat Log should surface conversion events.

---

## 12. Multi-hit

- each hit can hit/miss/crit independently
- status rolls per hit only when the skill explicitly says `per Hit`
- passive/Keystone triggers normally max once per Action unless explicitly per-hit
- one enemy multi-hit Action grants at most **+1 Aegis**

---

## 13. Hero special resources and locked Hero-Skill integration changes

Detailed skill tree/progression remains in `HERO-SKILL-SYSTEM-V1.md`. The following Battle V1 rules are final and override older TBD notes there.

### 13.1 Fury / Relentless Fury

- each Hero attack Action grants Fury +1, max 3
- Fury does **not** decay simply because the Hero uses a non-attack Action
- Fury persists until spent by its approved payoff or battle ends
- clear Fury at battle end

R5 kill behavior:

- on kill, attempt to reduce eligible cooling Active skill cooldown by 1, respecting the global CDR cap
- consume **1 Fury only if cooldown reduction actually succeeds**
- if no eligible cooling Active can be reduced, do not consume Fury

Other locked Relentless Fury values remain:

- each Fury: +3% Damage
- R2 while Hero HP <=40%: another +5% Damage
- R3 at Fury 3: 5% Stun chance, not increased by Tactic Debuff Chance
- R4 while Hero HP <=40%: another +5% Damage

### 13.2 Scheme / Usurper

- successful debuff grants Scheme +1 per Action, max 3
- each Scheme grants +3% Debuff Chance
- Scheme does not naturally decay
- Scheme clears at battle end

At Scheme 3 using an eligible Active:

- if a stealable buff is successfully stolen -> consume 1 Scheme
- otherwise, if an eligible existing debuff (excluding Stun) is successfully extended +1 Turn -> consume 1 Scheme
- if neither steal nor extension can occur -> do **not** consume Scheme

R4:

- after Scheme is successfully consumed, the **next Active** gains +10% Debuff Chance
- non-stacking
- still subject to global proc cap

R5:

- track cumulative successful Scheme consumes
- after 3 successful consumes, reduce eligible cooling Active skills by 1 Turn and reset the consume counter
- obey the global max-1-CDR-per-Action rule

### 13.3 Aegis / Thorned Aegis timing

Do not grant Aegis per individual enemy hit.

During a full Enemy Action, track whether the Hero was struck/qualifies. After the **entire enemy Action** resolves, and before battle-end evaluation, resolve Aegis at most once.

Therefore 5 hits from one enemy Action still grant at most +1 Aegis.

Keep the existing anti-loop rule:

- R4 auto-Counter only on transition `<3 -> 3`
- max once per enemy Action
- no retrigger while already at 3

Existing R1 decay behavior remains as currently specified unless a later approved design explicitly changes it.

### 13.4 Life Drain

Life Drain heals the approved percentage of Basic Attack damage by skill level, but healing is capped at:

**10% Hero Max HP per Action**.

### 13.5 Last Stand

Internal cooldown after a successful Last Stand proc:

**3 Hero Turns**.

### 13.6 Stunning Blow final damage

- R1: **145% ATK** + Stun 15%
- R2: **165% ATK** + Stun 25%
- R3: **185% ATK** + Stun 35%

### 13.7 Silent Edge final damage

- R1: **150% ATK** + Silence 25%
- R2: **170% ATK** + Silence 35%
- R3: **190% ATK** + Silence 45%

### 13.8 Guard final damage

- R1: **105% ATK** + DEF Up 1 Turn
- R2: **120% ATK** + DEF Up 2 Turns
- R3: **135% ATK** + DEF Up 2 Turns

All ranks use the shared DEF Up rule, Damage Taken -30%; do not create a stronger parallel DEF Up type for Guard R3.

---

## 14. Pet V2 as a real combat unit

Active Pet is a full combat unit with its own:

- HP
- ATK
- DEF
- Speed
- Accuracy
- Dodge
- Crit
- statuses
- cooldown
- Action
- death state

Pet participates in the same Speed Queue and shared status/cooldown engine as Hero/Monsters.

Detailed Pet stats/skills remain in `PET-SYSTEM-V2.md`.

### 14.1 Pet action flow

`Start Action -> Poison/DoT -> Stun -> AI choice -> damage/heal/status -> passive/extra -> cooldown/durations -> outcome`

### 14.2 Pet AI

Pet is autonomous in Dungeon Battle V1.

Attack/Control Pet:

- if Active is ready and usable -> use Active
- otherwise -> Basic Attack

Healing threshold: **60% HP**.

Sprout:

- Hero <=60% -> use Regrowth
- otherwise Basic Attack

Moon Hare:

- Hero OR living Pet <=60% -> use Moonlight Heal
- otherwise Basic Attack

### 14.3 Pet targeting

For Attack/Control single-target actions:

1. use current Hero-selected target if still alive;
2. otherwise target living enemy with lowest HP.

AoE/multi-target follows the Pet skill definition.

### 14.4 Pet Basic Attack

Pet Basic Attack uses Pet ATK and the shared Hit/Miss/Crit/Dodge rules.

### 14.5 Pet multi-target status

Multi-target Pet skills roll eligible status independently per target.

### 14.6 Pet cooldown while Stunned

If Pet loses an Action to Stun, its cooldown still ticks because that Pet Action passed.

### 14.7 Inferno Drake block

Guardian Scale:

- 20% chance to block a direct-damage attack targeting Hero
- blocked direct damage becomes 0
- attached debuff/status still rolls normally
- does not block DoT, Reflect, indirect damage or scripted boss mechanics

### 14.8 Storm Phoenix CDR

On successful debuff:

- 50% chance to reduce active Pet skill cooldown by 1
- max once per Action
- cannot reduce a cooldown newly created by that same Action
- no effect if no eligible cooldown exists
- obey global max-1-CDR-per-Action

---

## 15. Death, victory and defeat

Victory condition:

- all enemies are dead

Hero death does **not** automatically end the battle if Active Pet is alive.

If Hero dies but Pet remains alive:

- remove Hero from queue
- Pet continues fighting under AI
- if Pet kills all enemies -> Victory
- if Pet later dies too -> Defeat

Defeat condition:

- Hero and Active Pet are both dead
- if there is no Active Pet, Hero death = Defeat

Pet death:

- Pet leaves the queue and takes no more Actions in that battle
- Hero can continue
- participating Active Pet still receives Pet EXP even if it died, per Pet V2

Hero dies + Pet wins:

- Hero still receives normal battle EXP/reward/progression
- on the next floor Hero revives at **1 HP**

Pet lifecycle remains per Pet V2:

- normal-floor HP carries forward
- dead Pet revives Full HP on next floor
- Active Pet refills Full HP before Boss Floor
- no Pet potions

---

## 16. Between-floor Hero state

For normal Dungeon continuation:

- Hero HP carries forward
- Hero SP carries forward

Do not automatically Full Heal Hero before Boss Floor unless a separate later Dungeon/Boss rule explicitly says so.

Battle-only statuses/resources/cooldowns do not persist into the next battle unless a future rule explicitly says otherwise.

---

## 17. Battle-end cleanup

Victory:

- grant normal battle rewards/progression exactly once
- clear temporary battle buffs/debuffs
- clear Fury / Aegis / Scheme
- clear combat cooldowns
- Auto OFF

Defeat:

- normal Retry/Defeat flow
- do not grant unfinished-battle rewards
- clear battle-only state as appropriate
- Auto OFF

---

## 18. Battle UI / presentation contract

Maintain the existing approved Battle visual direction and mobile safe-area rules.

### 18.1 Top Bar

Left:

- Hero HP
- Hero SP
- EXP%

Middle:

- **4 upcoming Actions** from the actual Speed Queue
- current acting unit visibly highlighted
- dead/removed units immediately disappear/update

Right:

- x1/x2 speed control
- Skip when eligible from Hero turn 6

### 18.2 Battlefield

- Hero on left
- Pet near Hero
- 1–3 Monsters on right
- HP/status displayed above units instead of separate enemy/hero bottom HUDs
- selected target visibly highlighted
- auto-retarget updates highlight immediately

### 18.3 Resource display

Fury / Aegis / Scheme are special resource badges near Hero/Hero HUD area, not mixed into ordinary buff/debuff icons.

### 18.4 Quick Slots

Existing 4 slots continue supporting Active Skill and Potion.

- cooling skill -> show cooldown number over icon
- insufficient SP -> dim/disable
- Silence -> disable Active skills, not Potion
- Potion quantity zero -> disable
- do not hide unusable slots; player should see why they cannot be used

### 18.5 Attack / Auto / Flee / Settings

- Attack button always means Basic Attack
- Attack remains visible while Auto is ON
- Auto has a clear ON visual state
- Flee failure gets clear feedback
- preserve approved Battle layout assets/buttons where applicable

### 18.6 Floating feedback

Show near relevant unit:

- damage
- heal
- Critical
- Miss
- Dodge
- status applied/resisted

### 18.7 Combat Log

Keep latest **3 important messages**. Prioritize meaningful events rather than duplicating every floating damage number.

Examples:

- Stun converted to Critical
- Silence converted to 30% DEF Pierce
- Aegis reached 3 -> Counter
- Scheme consumed / buff stolen / debuff extended
- Fury consumed -> cooldown reduction
- Escape Failed

### 18.8 Animation semantics

Hero: Idle / Attack / Death

Pet: Idle / Attack / Death

Monster: Idle / Attack / Hurt / Death where assets exist

Damage/effect presentation should align with the hit timing rather than visibly landing before the attack.

x2 changes presentation delay only; it must not alter gameplay rules, turn counts, cooldowns or proc behavior.

Skip simulation plays no battle animations while fast-resolving.

---

## 19. Checkpoint / close-game / resume

Battle must support a safe resumable checkpoint.

Checkpoint points:

- battle start
- after a complete Action and all of its multi-hit/status/trigger resolution finishes

Never checkpoint mid-animation/mid-hit/mid-status-chain in a way that could replay half an Action after resume.

Checkpoint must preserve enough state to resume the exact battle safely, including at least:

- floor / battle identity
- Hero HP/SP/death state
- Pet HP/death/combat state
- enemy identities, HP and relevant combat state
- Round / queue / acting-position information required for correct continuation
- cooldowns
- status values/durations
- Fury / Aegis / Scheme and counters/next-Active modifier state
- Hero turn count used for Skip eligibility
- selected target

When player closes during normal Battle or Auto:

- battle does not continue in background
- do not automatically declare Victory/Defeat
- persist latest safe checkpoint

On return:

- Resume the battle from the safe checkpoint
- Auto resumes **OFF**

If a checkpoint is invalid/corrupt, fail safely without duplicating rewards. Prefer a safe restart of the battle/session over granting an unverified result.

---

## 20. Reward / result idempotency

Use a unique battle/run identity or equivalent idempotency guard so one completed battle result cannot be committed twice.

Reward/floor clear should commit only after real Victory resolution.

Reloading during/after Result presentation must not duplicate:

- EXP
- Gold
- Drops
- floor progression
- other battle rewards

Skip also resolves to one authoritative final result, then commits once.

---

## 21. Backend / database requirement

Battle Engine refactor does **not** require rebuilding the whole database.

Reuse existing save/run-state infrastructure where practical. Extend/migrate backend schema only for Battle V1 data that truly needs persistence (for example richer battle checkpoint state).

Any schema change requires:

- explicit migration plan
- existing-save compatibility validation
- preservation of unrelated player fields/data

Do not redesign inventory/currency/economy/backend systems merely to support this refactor.

Cloudflare/D1 production migration/deployment is a separate operational step if required by the chosen persistence implementation.

---

## 22. Legacy migration for Battle V1

Current stored data is mainly test data, so migration can stay simple where approved.

### 22.1 Hero legacy skills

- remove legacy skill-tree ownership from active gameplay
- reset Hero skill tree into Hero Skill V1
- grant/restore Skill Points according to the new V1 progression entitlement
- do not auto-map unrelated old skills into new skills
- if a Quick Slot references a removed legacy skill, clear only that invalid slot safely
- preserve unrelated character/inventory/currency/progression data

### 22.2 Pet legacy data

- Pet star >3 -> clamp directly to **3★**
- no compensation required
- no duplicate refund required
- `thunder_cub` -> migrate/map to `hell_wolf`
- preserve owned/active Pet identity and compatible instance data where practical

Do not perform unrelated economy changes.

---

## 23. Required QA / regression matrix

At minimum verify:

- Hero-only battle
- Hero + Pet
- 1 / 2 / 3 Monsters
- Hero fastest / Pet fastest / Monster fastest
- queue shown = queue actually resolved
- Basic Attack
- Active Skill
- Potion
- insufficient SP / cooldown / Silence disabled states
- Auto ON/OFF and Auto OFF after battle/resume
- Flee success/failure
- Skip hidden through Hero turn 5
- Skip available at Hero turn 6
- Skip -> Victory
- Skip -> Defeat
- Poison tick before Action
- Poison kill prevents Action
- Stun
- Silence
- Armor Break
- DEF Up
- Status Resist percentage-point subtraction
- Boss Stun conversion
- Boss Silence conversion
- failed Stun proc does not cancel natural Crit
- multi-hit independent hit/crit behavior
- Aegis max +1 per enemy Action
- Aegis resolution after full enemy Action
- Fury gain/persist/conditional consume
- Scheme gain/persist/steal/extend/conditional consume/R4/R5
- Life Drain 10% Max-HP-per-Action cap
- Last Stand 3-Hero-Turn ICD
- Hero dies + Pet wins
- Pet dies + Hero wins
- Hero + Pet die -> Defeat
- no-Pet Hero death -> Defeat
- Hero next-floor revive at 1 HP after Pet clutch Victory
- Pet next-floor revive/full-before-Boss behavior
- close/reload normal Battle
- close/reload during Auto
- reward idempotency / no duplicate claim after reload
- old Hero skill save migration
- Pet >3★ clamp
- Thunder Cub -> Hell Wolf mapping
- x1/x2 presentation-only speed change
- mobile safe area / overflow / touch targets
- battle assets/fallback loading
- save/reload and backend integrity if checkpoint schema changes

---

## 24. Implementation/release constraints

This is a large/high-risk gameplay refactor.

Implementation should occur on a dedicated branch/PR from latest `main`.

Before coding:

- inspect latest `main`
- inspect current Battle implementation and related docs
- do not overwrite/revert unrelated work

Source changes:

- edit source only
- run `node build.js`
- do not hand-edit generated `index.html`
- do not reintroduce retired `app-v2.html`

User acceptance focuses on playable behavior. Do not merge/deploy production Battle V1 until the requested review flow is satisfied.

---

## 25. Future reuse target

The intended game loop is:

**Dungeon Farm -> Build Hero/Pet -> choose PvE Raid and/or PvP Arena**

Battle V1 should therefore establish shared combat foundations that future modes can reuse:

- Hero/Pet combat-unit builders
- stat access
- damage/hit/crit resolution
- Speed Queue
- statuses/resists
- skills/cooldowns
- Fury/Aegis/Scheme
- death/outcome primitives
- Boss/Raid conversion where applicable

Future Raid/Arena mode rules may override mode-specific behavior, but must not require copying the entire Dungeon Battle implementation.
