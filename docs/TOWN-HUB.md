# Town Hub UI Contract

This document keeps only stable Town/Hub architecture rules. Feature availability should be read from current code, not duplicated here as a status list.

## Artwork and interaction separation

- Town background art must not contain interactive labels, currency values, buttons, or navigation text.
- Labels, hit targets, routes, and interaction states remain code-rendered so they can change without regenerating artwork.
- Decorative elements may be separate assets when they need independent positioning or animation.

## Navigation consistency

- Main Hub and Town should share the same bottom-navigation interaction pattern and icon language.
- Character, Inventory, Pets, and More must behave consistently between screens.
- Page-specific destinations may differ, but shared navigation must not be independently reimplemented per page.

## Mobile UI rules

- Mobile-first layout; respect safe areas and avoid text overlap.
- Keep the established ThornieDungeons visual language unless a redesign is explicitly approved.
- Prefer reusable components over page-specific duplicated controls.
- Background artwork and UI chrome should remain independent layers.

## Build rule

- Edit source modules only.
- Do not hand-edit generated `index.html`.
- Run `node build.js` after source changes.
- `index.html` is the single generated application entrypoint.
