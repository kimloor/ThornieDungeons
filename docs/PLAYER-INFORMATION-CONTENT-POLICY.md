# ThornieDungeons — Player Information Content Policy

Status: **APPROVED / PLANNING CONTRACT — WAVE 1.5**

This contract governs player-facing informational content introduced by WAVE 1.5. It does not itself change gameplay, economy, API/Worker, database, save, reward or player-data authority.

## 1. Player Information Center

Settings will provide a shared information center containing:

- **Announcements** — Latest Update, Version History and Public Roadmap.
- **Game Guide / Help** — authoritative player-readable game rules and mechanics.
- **Terms of Service**.
- **Privacy Policy**.
- **Fair Play / Community Rules**.
- **Purchase & Refund Policy**.
- **Account & Data** information.
- **Support / Contact** information.
- **Credits / Licenses**.

Policy/legal content should expose version, effective date and last-updated metadata where applicable. The Guide architecture should support section/deep links for future contextual `?` help actions.

## 2. Source of truth

At implementation and every material update:

1. Audit the current Production implementation.
2. Compare it with current authoritative contracts.
3. Resolve meaningful code/contract conflicts before publishing player-facing numbers.
4. Do not use chat memory or superseded historical documents as balance authority.
5. Reconstruct historical patch notes from Git/release/document evidence rather than guessing.

Examples of Guide content include drop/acquisition rates, Refine success/economy rules, Enchant options and ranges, stats/caps, CC/Boss rules, Set bonuses, Dungeon/Arena/Raid/Pet rules, rewards and other mechanics that materially affect player decisions.

## 3. Public-information boundary

Player-facing content may explain normal gameplay rules, probabilities, costs, limits, rewards and expected system behavior.

Do not publish internal security/anti-cheat design, authentication/session internals, secret or sensitive configuration, exploit-enabling validation details, private operational procedures, internal QA gates, migration mechanics or other information that would unnecessarily weaken system safety.

The Public Roadmap is a curated player view. Use player-readable states such as Completed, In Development and Planned. Do not promise release dates unless Project Lead has explicitly committed to them.

## 4. Data-driven content

Keep informational content separate from presentation where practical. Announcement entries, Guide sections, roadmap entries and policy metadata should be maintainable without rebuilding image-based layouts or duplicating balance values across components.

Graphics assets provide visual identity only; text and changing numeric content remain runtime/data-driven.

## 5. Release maintenance rule

Every release that changes player-relevant gameplay rules, balance values, probabilities, costs, rewards or documented system behavior must review the affected Game Guide content and the release Announcement before release completion.

A release must not knowingly leave authoritative player-facing Help contradicting the shipped Production behavior.

## 6. Legal and policy boundary

W1.5 prepares the policy UI/content architecture and drafts appropriate to the service that exists at that time. Terms/Privacy/Purchase wording must be based on the actual account, data, provider and monetization design rather than copied generic boilerplate.

Real-money checkout remains disabled until a separately approved pre-live-monetization Legal & Policy Gate is complete. Before commercial monetization, policies must be re-audited against the actual payment/data flow and receive appropriate final legal review for intended launch markets.

## 7. Graphics boundary — G15

G15 Player Information Center UI Pack owns the production visual identity for:
- Announcements;
- Game Guide;
- Terms;
- Privacy;
- Fair Play;
- Purchase Policy;
- NEW badge;
- Public Roadmap status presentation.

Reusable cards, tabs/accordion, typography, scrolling, responsive behavior and deep-link navigation remain runtime UI. Do not bake release-specific announcement text or changing Guide numbers into artwork.

## 8. Scope control

W1.5 is informational/presentation work unless a separately approved defect is discovered. Do not change gameplay balance, reward authority, economy, API/Worker, DB/schema or player data merely to make Guide content match an assumption. Report conflicts and resolve the authoritative rule first.

## 9. Implementation notes (Ver 1.1.5: PR A + B + D)

Owner decisions: separate full-screen page opened from a button in Settings; Thai only; Support / Account & Data / Credits are reserved areas without details; Game Guide (PR C) is a separate later PR; policy drafts (PR D) do not depend on the Guide, so they ship with the structure and announcements.

- Data: `src/data/infoCenter.js` (`INFO_CENTER`: groups, sections, announcements, roadmap; helpers `infoFindSection`, `infoResolveRoute`, `infoLatestVersion`). Presentation: `src/ui/infoCenter.js` (`InfoCenterScreen`). Entry: Settings > "ข้อมูลและนโยบาย".
- Deep links: route `"section"` or `"section/topic"` through `infoResolveRoute`; `InfoCenterScreen({ initialRoute })` opens it, unknown routes fall back to the menu. Guide topics are not defined yet (PR C).
- NEW badge: compares the latest announcement version with `localStorage` key `td.info.seenVersion`; opening Announcements marks it seen.
- Version history was reconstructed from Git evidence (each change of the `Ver x.y.z` badge in `src/data/styles.js`, plus the PR/commit subjects), grouped into ranges. Versions before 1.0.7 have no verifiable record and are not listed.
- Policy drafts (Terms, Privacy, Fair Play, Purchase & Refund) are version 0.1 / `status: "draft"`, written from the services actually in use at 2026-10-22 (Cloudflare Pages/Workers/D1/R2, unpkg for React, Google Fonts; no ads and no third-party analytics found in the client code; session in `sessionStorage`; audio/sort/cache in `localStorage`; IP used for rate limiting). They are not legal review; real-money checkout stays disabled until the Legal & Policy Gate.
- Release rule reminder: every release that changes player-relevant behaviour updates `INFO_CENTER.announcements` (latest + history); `tests/info-center.test.js` fails if the latest announcement does not match the visible version.
- Tests: `tests/info-center.test.js` (data integrity, reserved areas, draft status, deep links, version sync, roadmap without dates, public-information boundary word check, UI wiring).

## 10. Settings reorganisation (Ver 1.1.6)

Owner decisions: remove the duplicated shortcuts from the bottom "More" menu entirely (Guild, Chat and Main Hub already exist in Town / Hub); Settings becomes a menu of sub-pages; Friend stays in More; remove the Save button.

- More menu now holds only Settings and Friend. `GameDock` no longer takes `onSave`, `onChat`, `onGuild`, `onMainHub` (the screens still pass them; they are ignored and can be cleaned up later).
- Settings menu: Sound / Account & Security (Recovery Code, Change Password) / Character & Data (switch character, sync status) / Information & Policy (opens the Information Center) / Logout (separate, at the bottom). Each sub-page has a back arrow; the close button stays available.
- Save removal rationale: the persistence queue (`src/state/persistence.js`) is drained immediately on every enqueue (`commitInventorySnapshot`, run state, checkpoints, quick slots), failed transient writes retry on `online` and `visibilitychange`, and logout / character switch flush first. The manual button only re-sent failed writes, which is now "Settings > Character & Data > Retry sync" (shown only when the status is `failed`). `manualSave` in `App.js` is kept for that retry.
- Tests: `tests/settings-reorg.test.js`; navigation tests updated for the smaller More menu.
