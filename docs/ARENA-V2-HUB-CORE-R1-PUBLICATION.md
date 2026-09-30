# Arena V2 Hub Core R1 publication

Base main: `60007fa53be56cd9da5d5c2ef4d36efbf26b99f6`
Publication commit: recorded after the normal main-push R2 workflow completes.

Exact approved R1 exports; no regeneration or pixel modification.

| Final repository path | Canvas | Manifest key | Source inset (all sides) |
|---|---|---|---|
| `r2-upload/ui/arena/hub/arena_emblem.png` | 512×512 | `assets.arenaUi.hub.emblem` | — |
| `r2-upload/ui/arena/hub/panel_frame.png` | 768×512 | `assets.arenaUi.hub.panelFrame` | 64 |
| `r2-upload/ui/arena/hub/row_frame.png` | 768×160 | `assets.arenaUi.hub.rowFrame` | 48 |
| `r2-upload/ui/arena/tabs/tab_active.png` | 256×128 | `assets.arenaUi.tabs.active` | 22 |
| `r2-upload/ui/arena/icons/icon_battle.png` | 256×256 | `assets.arenaUi.icons.battle` | — |
| `r2-upload/ui/arena/icons/icon_setup.png` | 256×256 | `assets.arenaUi.icons.setup` | — |
| `r2-upload/ui/arena/icons/icon_ranking.png` | 256×256 | `assets.arenaUi.icons.ranking` | — |
| `r2-upload/ui/arena/icons/icon_history.png` | 256×256 | `assets.arenaUi.icons.history` | — |
| `r2-upload/ui/arena/tabs/tab_inactive.png` | 256×128 | `assets.arenaUi.tabs.inactive` | 22 |

Use nine-slice for panels/rows/tabs; never distort the entire bitmap. Active/inactive alpha masks match exactly. Icons display at 24–32 CSS px; Setup/History minimum 24 px. All dynamic labels stay in DOM.

Validation: 9/9 source SHA-256 matches; approved dimensions and RGBA alpha bounds match; transparent corners; tab alpha equality; all existing manifest values preserved. Approved review shows clean edges without matte/checkerboard. Resolver and R2 verification recorded below after publication.

Previous background, currencies, rank frames, Social Player Card and shared Battle assets preserved. No UI/gameplay/source changes, no frontend build or Production deploy.
