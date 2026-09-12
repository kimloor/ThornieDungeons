# ThornieDungeons — Agent Working Rules

This file defines the default operating rules for all contributors and AI agents working on ThornieDungeons, including ChatGPT and Claude.

## 1. Source of truth
- Always check the latest `main` and relevant current files before changing anything.
- For approved design changes, the latest user-approved task overrides older documentation; update affected docs afterward.
- If code, docs, and task instructions conflict in a way that affects behavior, stop and ask before proceeding.
- Do not rely on old chat context when current repository state can be checked directly.

## 2. Build and generated files
- Edit source files, configuration, or documentation only where required by the task.
- `index.html` is generated output and must not be edited by hand.
- After source changes, run `node build.js` and verify the generated `index.html`.
- `app-v2.html` is retired and must not be reintroduced unless explicitly approved.

## 3. Working together
- Before any fix, feature, redesign, or integration, inspect the latest repository state first.
- Read and change only the files and code paths related to the task.
- Never revert, overwrite, or clean up unrelated work.
- Keep token/context usage to what is necessary for the task; avoid rereading unrelated files.
- ChatGPT and Claude may work on the same project. Leave useful comments or documentation for non-obvious decisions so another contributor can continue safely.
- Comment only where useful: business/game rules, compatibility reasons, workarounds, non-obvious constraints, TODOs, and known limitations. Do not over-comment ordinary code.

## 4. Risk, release, merge, and deploy
- Assess the risk of each change and choose the appropriate implementation/testing path.
- If the requirement is unclear or confirmation is needed, stop and ask before making the uncertain change.
- After assessing and fixing the task, merge/deploy when appropriate and verify the result; then report a short, clear summary.
- Always ask before changes that can permanently delete player data, perform irreversible migrations, or make major economy-wide changes.
- Do not change unrelated production API/Worker behavior just to make a test pass.

## 5. Gameplay and game design
- Do not introduce or materially change mechanics, balance values, status rules, prerequisites, economy rules, or progression rules without reporting the proposed change first.
- Follow the latest approved game-design specification.
- If an exploit, infinite loop, severe power creep, broken prerequisite, or rule conflict is discovered, report it before redesigning the behavior.
- Shared Boss/Raid/PvP rules should be implemented as shared rules when possible instead of duplicated per skill or feature.

## 6. Save data and backend safety
- Preserve backward compatibility for existing players whenever possible.
- Existing characters and saves must remain loadable after normal feature updates.
- Schema changes require an explicit migration plan and validation.
- Preserve unrelated data fields when serializing or migrating data.
- Treat authentication, player inventory, currencies, progression, rewards, and transaction logic as high-impact areas requiring targeted regression checks.

## 7. UI and UX
- Design and implementation are mobile-first.
- Preserve the established ThornieDungeons visual language unless the task explicitly requests a redesign.
- Reuse existing components and interaction patterns before creating parallel systems.
- Keep artwork/backgrounds separate from text, hit targets, and interactive UI where practical.
- Verify safe areas, overflow, touch targets, and responsive behavior on mobile layouts.

## 8. Assets, R2, and manifest
- Follow `r2-upload/README.md` for R2 staging and path rules.
- Verify manifest keys, R2 paths, references, and fallbacks together when asset paths change.
- Do not rename or move production asset paths without updating all references.
- Do not regenerate or replace approved artwork unless the task explicitly requires it.
- Missing optional assets should fail gracefully where a fallback is defined.

## 9. Testing and verification
- Test the changed behavior and relevant regressions; do not run unrelated broad checks without reason.
- Combat changes should verify turn flow, damage, status effects, cooldowns, animation triggers, and save/reload where relevant.
- UI changes should verify mobile layout, safe area, overflow, interaction, and asset loading.
- Backend/save changes should verify existing-player compatibility and transaction/data integrity.
- After merge/deploy, verify the live result when the deployment path is available: page/endpoint loads, changed feature works, obvious errors are absent, and critical asset paths are not 404.

## 10. Documentation
- Keep current system contracts in `docs/*.md`; remove or update obsolete documents instead of leaving conflicting specifications.
- Update docs when an approved rule, architecture, or production contract changes.
- Task-specific temporary notes should not become permanent source-of-truth files unless they contain reusable contracts.

## 11. Handoff and reporting
- Keep handoffs concise and include only what the next contributor needs.
- At minimum report: what changed, files/systems affected, tests performed, known issues, and commit/branch when relevant.
- Do not claim a task is complete when a known issue still blocks the requested scope.

## 12. Definition of done
A task is complete when the relevant steps are satisfied:
1. Latest state checked.
2. Scope understood.
3. Only related changes made.
4. Required tests pass.
5. Build passes when source changed.
6. Merge/deploy completed when appropriate.
7. Live result verified when deployment is available.
8. Relevant docs/comments updated.
9. Short final summary provided.
