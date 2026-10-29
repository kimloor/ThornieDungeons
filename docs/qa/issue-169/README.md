# Issue #169 — Mobile Viewport-Fit QA

Date: 2026-10-28  
Branch base: `ca84ae56ab8015b1e2902596a23c9e50a57ac1eb`

## Root cause

The overflow was cumulative rather than page-specific:

1. `.md-root` enforced `min-height:max(640px,100dvh)` while the desktop body also added 16px top and bottom padding.
2. Hub, Town, Character, Dungeon Map, Pet, Friend and Chat repeated 640px minimums. Hub and Town added 365px/470px world minimums.
3. Character, Dungeon Map and Arena used their own `100dvh` height inside a root that also contains the global currency bar.
4. Tablet/desktop rules restored `height:100dvh` on Pet/Friend/Chat, so the currency row was added above another full viewport.
5. Long content sometimes scrolled at the page level, allowing the dock/header to move instead of assigning scroll authority to the content panel.

## Implementation

- The document, `#root` and `.md-root` now share a single height derived from `visualViewport.height`, with `100dvh` as the fallback.
- Resize, visual-viewport resize/scroll, software-keyboard changes and orientation changes resynchronize the height token.
- Top-level page shells use `flex:1 1 auto; min-height:0; max-height:100%`.
- Hub/Town artwork stages absorb available height; Character and Map retain their existing bounded content surfaces.
- Pet/Friend/Chat keep their headers and dock in flow while designated cards scroll internally.
- Short-height and landscape rules reduce spacing and art/icon envelopes while retaining 44px minimum critical touch targets.
- Safe-area tokens and the shared global currency row remain in the existing flow.

## Production baseline measurement

Cloud-browser measurement against the live Ver 1.1.24 Login page at 1363×936:

| Metric | Value |
| --- | ---: |
| `window.innerHeight` | 936 |
| `visualViewport.height` | 936 |
| `documentElement.clientHeight` | 936 |
| `documentElement.scrollHeight` | 968 |
| `body.scrollHeight` | 968 |
| `.md-root` top / bottom | 16 / 952 |
| Outer vertical overflow | **32px** |

This is direct runtime evidence that body padding plus a full-viewport root caused outer document overflow even on desktop.

## Candidate viewport contract

`tests/mobile-viewport-fit.test.js` verifies the document/root height authority and budgets for:

| Viewport | Expected document overflow | Layout mode |
| --- | ---: | --- |
| 320×568 | 0px | narrow portrait |
| 360×640 | 0px | portrait |
| 375×667 | 0px | portrait |
| 390×844 | 0px | portrait |
| 393×852 | 0px | portrait |
| 430×932 | 0px | wide portrait |
| 667×375 | 0px | landscape compact |
| 844×390 | 0px | landscape compact |
| 1280×720 | 0px | desktop |

The contract also asserts bounded internal scrolling for Character, shared overlays (Inventory, Mailbox and Guild), Pet and Friend, and verifies 44px critical landscape targets.

## Automated QA

- Targeted responsive/navigation/overlay/gameplay regression: **114/114 PASS**
- Full repository regression (`node --test --test-concurrency=1 tests/*.test.js`): **922/922 PASS**
- `node build.js`: **PASS** (`index.html` regenerated from 71 modules)
- `git diff --check`: **PASS**
- Artwork/manifest/backend diff: **none**

## Visual QA limitation

The live baseline screenshot was captured in the work session. The repository has no branch-preview deployment, the execution environment has no local Chromium binary, and the task explicitly prohibits deployment before Project Lead review. Therefore an actual-browser candidate screenshot and authenticated per-page canvas walkthrough cannot be attached until a review preview URL exists. No production deployment was performed to manufacture that evidence.

The source audit and automated suite cover Login, Main Hub, Town, Character, Map, Combat, Inventory, Crafting, Mailbox, Guild, Pet, Shop, Arena, overlays, navigation and loading behavior. Project Lead should run the viewport matrix on the review preview before merge.
