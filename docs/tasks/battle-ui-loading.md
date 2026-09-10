# Battle UI + Asset Loading Optimization

## Goal
Continue the unfinished Battle/Combat page redesign and reduce perceived/actual image loading latency on mobile.

## Flow
Project Lead -> Graphics -> DEV -> QA -> User Check -> Release

## Graphics scope
Create/prepare production-ready Battle UI assets for:
- Top Bar
- Quick Slot frame
- Auto button
- Flee button
- Settings button
- Attack button
- HP / Status frame

Rules:
- Match current ThornieDungeons visual language.
- Mobile-first readability.
- Transparent background where applicable.
- Clean alpha, no stray pixels/dirty fringe.
- Stable filenames and R2 paths.
- Reuse approved/current art where applicable; do not regenerate approved hero/pet/monster assets.
- Graphics does not change gameplay logic.

## DEV integration scope
After Graphics handoff:
- Integrate Battle UI assets through the current manifest/R2 asset system.
- CSS should remain responsible for layout, responsive sizing, safe area, hit areas, and interaction states rather than redrawing the visual chrome.
- Preserve current combat behavior.

## Asset-loading optimization scope
Investigate and implement targeted optimizations for Battle entry:
1. Preload only encounter-critical assets before entering Battle:
   - Battle UI
   - currently equipped Hero visuals
   - active Pet
   - current Monster/Boss idle assets
2. After critical idle assets are ready, warm attack/death/non-critical animation frames in the background.
3. Avoid repeatedly measuring transparent sprite bounds at runtime when stable bounds/anchor metadata can be stored/reused from manifest data.
4. Keep lazy loading for non-visible/non-critical icons and assets.
5. Preserve browser/R2 cache behavior; do not add cache-busting to immutable image files.
6. Do not convert or regenerate approved artwork just for optimization unless explicitly required.
7. If sprite atlas/sheet consolidation is proposed, it must reuse existing approved frames and preserve animation behavior.

## Acceptance criteria
- Battle page uses the new graphic UI assets in all required controls/frames.
- No regression to combat state, turns, damage, animations, hit targets, safe area, or responsive layout.
- Critical Battle scene becomes usable without waiting for unrelated assets.
- Attack/death frames can continue warming after initial scene is visible.
- No repeated expensive transparent-bound analysis for the same stable sprite data when avoidable.
- Graceful fallback remains when an optional asset is missing.
- Source/runtime build outputs stay synchronized.
- Targeted syntax/build/runtime checks pass.
- QA includes mobile responsive checks and asset-path/manifest checks.
