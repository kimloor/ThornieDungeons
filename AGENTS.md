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
- Project Lead may inspect code/state, reproduce issues, analyze likely root causes, and perform low-risk preliminary checks before handing work to another agent.
- Project Lead should avoid duplicating implementation work that belongs to DEV/QA/Graphics unless the task is low-risk or direct inspection is the fastest safe path.
- ChatGPT and Claude may work on the same project. Leave useful comments or documentation for non-obvious decisions so another contributor can continue safely.
- Comment only where useful: business/game rules, compatibility reasons, workarounds, non-obvious constraints, TODOs, and known limitations. Do not over-comment ordinary code.

## 4. Risk, release, merge, and deploy
- Assess every task as LOW, MEDIUM, HIGH, or VERY HIGH before implementation.
- LOW and MEDIUM risk changes may be committed/published directly to `main` after the required checks pass, unless the task explicitly requires another branch.
- HIGH and VERY HIGH risk changes require explicit user/Project Lead approval of the publish destination before any remote write. Ask whether the completed change should go to `main` or a feature branch; do not choose the destination autonomously.
- Destination approval does not waive testing, QA, migration, or deploy gates that apply to the task.
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
- For any user-visible staging/preview fix that the user must reopen in a browser, bump the visible preview patch version before deployment so stale-cache reports can be distinguished from the new build.
- After merge/deploy, verify the live result when the deployment path is available: page/endpoint loads, changed feature works, obvious errors are absent, and critical asset paths are not 404.

## 10. Documentation
- Keep current system contracts in `docs/*.md`; remove or update obsolete documents instead of leaving conflicting specifications.
- Update docs when an approved rule, architecture, or production contract changes.
- Task-specific temporary notes should not become permanent source-of-truth files unless they contain reusable contracts.

## 11. GitHub commit and publish protocol
- Treat the authenticated GitHub connector/tool as a first-class publish path, not merely an emergency fallback. Local shell `git push` is optional and should be used only when the environment already has working GitHub network access and authentication.
- Never spend task time repairing sandbox GitHub credentials, injecting PATs, creating ad-hoc SSH keys, or retrying a known-unavailable network path. Never expose GitHub tokens, PATs, passwords, or secret values in source files, prompts, logs, or chat.
- Before every remote write, read the latest target branch HEAD and confirm the task's risk routing under section 4.
- For a small single-file text/document change, an authorized connector may update the file directly using its current blob SHA on the approved target branch.
- For normal multi-file publication through the connector:
  1. Read the latest approved target branch HEAD and its tree.
  2. Create blobs for the intended changed file contents.
  3. Create a new tree using the current target tree as the base so unrelated files are preserved.
  4. Create one commit whose parent is the target branch HEAD read in step 1.
  5. Re-check that the target branch has not moved. If it moved, rebuild on the new HEAD instead of overwriting newer work.
  6. Update the branch ref with a normal fast-forward only; `force=false`.
  7. Verify the remote HEAD, parent, changed files, and resulting contents/tree after publication.
- Never force-push unless the user explicitly authorizes that exact operation.
- Connector-created commit SHAs may differ from a local sandbox commit SHA. When the intended contents are identical, verify file contents/tree state instead of requiring identical commit object SHAs.
- If shell `git push` fails but an authorized connector exists, switch to the connector immediately; do not repeatedly retry HTTPS/SSH.
- If no authorized publish path is available, return `PUSH_BLOCKED` with local HEAD, changed files, test status, and the exact remaining publish action. A patch/file handoff is a fallback only when no direct authorized GitHub write path is available.

## 12. Task prompts, handoff, and reporting
- Project Lead task prompts must be short, direct, token-efficient, and still include every required action, constraint, environment, risk, and completion condition needed to execute safely.
- Remove background/history that the receiving agent does not need. Prefer explicit scope, DO/DO NOT rules, and expected output.
- Keep handoffs concise and include only what the next contributor needs.
- After completing work, the receiving agent must return a short copy-ready handoff prompt for Project Lead.
- The return handoff should include, when relevant: status marker, result, files/systems changed, tests/verification, branch/commit, blockers or known issues, and the exact next required action.
- Do not claim a task is complete when a known issue still blocks the requested scope.

## 13. Definition of done
A task is complete when the relevant steps are satisfied:
1. Latest state checked.
2. Scope understood.
3. Only related changes made.
4. Required tests pass.
5. Build passes when source changed.
6. Merge/deploy completed when appropriate.
7. Live result verified when deployment is available.
8. Relevant docs/comments updated.
9. Short copy-ready handoff provided.
