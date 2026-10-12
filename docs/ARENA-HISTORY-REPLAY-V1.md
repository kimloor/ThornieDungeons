# Arena History Replay V1

Status: **RELEASE CANDIDATE 1.0.52 — QA REQUIRED**

## Scope
- Replay is available only from Arena V2 HISTORY (ATTACK and DEFENSE).
- Dungeon history is explicitly out of scope.
- Keep the existing five latest matches per current season; this feature does not add old-season browsing.

## Playback
- The server returns the locked match presentation snapshot plus ordered public state frames recorded in `arena_match_actions`.
- The client plays recorded frames in sequence through the shared Phaser Arena presentation. Controls: play/pause, previous, next, replay again, close.
- Playback is presentation-only. It must not call prepare/activate/submit/surrender/settlement endpoints, consume Tickets, award rewards, change rating, or mutate the saved character/current match.
- Access is authorized by the current authenticated character being a participant in the match history row; unrelated match existence is not disclosed.

## Data availability and bounds
- No new D1 table or migration. Reuse the existing Arena match snapshot, action ledger, and history row.
- Replay is offered only when action sequences are contiguous from 1, every stored response contains a valid Arena public state, and the sequence is within the bounded 40-action payload limit.
- Legacy, partial, or malformed ledgers show **REPLAY N/A** instead of fabricating missing actions.
- Existing retention and current-season history rules remain unchanged; no additional long-term event retention is introduced.

## Matches that finish during Activation
- Activation resolves the opening defender/Pet turns through Battle Core. If the match ends there (for example a faster, stronger defender defeats the attacker before the first attacker action), the match is stored as done with `activated_at == completed_at`, `arenaActionSeq = 0` and **no** `arena_match_actions` rows.
- Such a match is replayable with zero recorded frames: the endpoint re-simulates the opening from the locked snapshot and match id (the same computation Activation used) and returns `frames: []` with the terminal `initialState` (final board and log). There is no turn-by-turn animation because no player actions exist.
- Safety guard: the re-simulated combat result and winning side must equal the stored result. On any mismatch, missing snapshot, or error the endpoint keeps returning **REPLAY N/A**; frames are never fabricated. Gapped, partial, malformed or over-40-action ledgers are still N/A.
- The history list marks these matches as available using the same activation-finish condition; the replay endpoint remains the final authority and the client shows the existing N/A message if it answers unavailable.
- The client shows "Match ended during the opening turns", the full opening log, and disables the Play/Replay-again button for zero-frame replays. The path stays read-only.

## QA gate
- Test ordered frames, missing/gapped ledger fallback, participant authorization, and no mutation to Ticket balance, match status, or reward receipts.
- Run `node --check workers/thornie-dungeons-api.js`, `node --check src/ui/components.js`, Arena lifecycle tests, Battle Core parity, and `node build.js` with `git diff --exit-code -- index.html`.
- This is a separate PR from Phaser damage feedback PR #117 and must not merge/deploy without Owner approval.

## Replay presentation notes
- The replay overlay owns a positioned stage (`md-arena-phaser-stage md-arena-replay-stage`) at least 280px tall (same proportions as the live battle) because the shared battle scene anchors heroes at half the stage height and never scales them below 0.82; a shorter stage clips the heroes' heads. The card scrolls on very short screens and the controls stay pinned at the bottom; landscape phones use two columns.
- `BattleScene` remembers the highest cue/damage sequence it played per `battleId`. The overlay therefore appends a run id to the replay `battleId` and increments it on every backward seek and on REPLAY AGAIN, with `presentationSkip` set for jumps so old damage numbers do not re-play; stepping forward one frame or autoplay animates normally.
- Controls reuse the shared Arena art buttons (`md-arena-art-btn`); replay CSS only lays them out.
