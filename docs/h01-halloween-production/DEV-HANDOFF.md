# H01-05–07 DEV handoff

Status: **Draft PR candidate; local integration complete; H01-08 QA required**

Branch: `feat/h01-05-07-dev`

Base: H01-04 approved Graphics head `9cbe1c0af9b7579613f59435e326fd5ae45f8a7c` (includes main `2c0304d267ac0b89a76681991b0090bece2fdbc9`)

## Delivered

- H01-05: authoritative event-status read, hidden inactive UI, five-second Raid/Halloween Hub rotation with cleanup and correct destinations, plus the approved upper-left map gate without global floor-gate layout changes.
- H01-06: server-config Bangkok calendar-month lifecycle; fixed `haloween_nightmare`; secure persisted encounter/reward seeds; reference Chapter Boss stats; deterministic Normal/Skill cadence with equal first skill and no consecutive skill repeats; expiry-safe resume; exclusive 5% Excaliburnt / 95% boss gold plus boss XP; no stone, first clear or floor unlock.
- H01-07: exact approved Gate/Boss/Icon/Weapon bytes staged at runtime paths; revisioned manifest keys; normal inventory icon and equipment binding; scoped hand occlusion for bare, Azure, Leather and mixed gloves; accepted transparent Death convention preserved.

## Verification

- `node --test tests/h01-halloween-event.test.js`: 7/7 PASS, including 56/56 equipment/frame contracts and byte-for-byte approved/staged comparisons.
- `node --test tests/api-policy.test.js tests/error-catalog.test.js`: PASS after registering the new read/write/error contracts.
- Full `node --test tests/*.test.js`: 929/934 PASS. The remaining five failures reproduce on the untouched H01-04 base and concern existing version/global-loading/safe-area/shop-layout assertions, not H01.
- `node build.js`: PASS; generated `index.html` contains the new client policy, API and runtime binding.
- `node --check workers/thornie-dungeons-api.js`: PASS.
- Phaser Canvas browser fixture: `qa/recovery-canvas.html` executes the production EquipmentVisualResolver → HeroV5RuntimeContract → HeroRenderer path for 7 equipment states × 8 frames.

## Browser / publication evidence

- Phaser Canvas 56-case browser run: **PASS (2026-10-30)** — Canvas renderer (`renderer: 1`), 56/56 cases, `loadFailures: []`, `orderFailures: []`, `gripFailures: []`. Representative mixed-equipment Attack rendering was visually inspected with the Excaliburnt sword and scoped hand-over-grip pass visible.
- Production R2 upload, public decode and SHA read-back: **NOT RUN — outside Draft implementation authority**.
- Real staging D1 Worker concurrency/rollback/expiry: **NOT RUN — no staging binding is present in this checkout; H01-08 blocker**.

## Release boundary and H01-08 focus

Do not merge, deploy, activate `game_config.halloween_event_v1`, publish R2, or bump the player-visible version from this handoff. H01-08 must independently exercise actual D1 start/expiry/resume/concurrent completion/Overflow behavior, confirm mobile and desktop gate/banner interaction, verify public asset read-back after authorized publication and review the five inherited baseline failures. Admin PR #182 remains isolated and untouched.
