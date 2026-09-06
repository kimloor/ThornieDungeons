# Town Hub implementation note

The Town screen was implemented from the approved September 2026 mobile mockup.

## Artwork and UI separation

- `ui/town-background.webp` is a clean production background derived from the approved
  bright-village concept. It intentionally contains no labels, buttons, currency values or
  navigation UI.
- All Town labels and hit targets are rendered in `src/ui/components.js` and styled in
  `src/data/styles.js`. Keep them code-rendered so text, positions and routes can change
  without regenerating the background.
- The messenger bird is a separate vector asset at
  `ui/town-icons/leaderboard-bird.svg`; the word `Leaderboard` is HTML below it.

## Navigation

- `phase === "town"` renders the Town hub.
- The former character/status screen moved to `phase === "character"` and is opened by
  the Character dock button.
- `GameDock` is shared by Town and Main Hub so Character, Inventory, Pets and More use
  one icon set and one interaction pattern.
- Town links that already have systems are live: Shop, Enhancement, Summoning,
  Leaderboard and the return to Main Hub/dungeon.
- Home/Crafting, Guild, Arena and Chat remain visible placeholders and currently show a short
  “กำลังพัฒนา” notice until their systems are implemented.

## Build rule

Edit the source modules, never `index.html` or `app-v2.html` directly. Run
`node build.js` after source changes; the build intentionally writes both generated
entrypoints to keep the Cloudflare versioned-root workaround synchronized.
