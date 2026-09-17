# ThornieDungeons Navigation & Settings V1

Status: **ACTIVE-PRODUCTION — current shared navigation/settings contract**

## 1. Purpose

This document defines the shared navigation and Settings behavior used across current production pages. It exists to prevent page-specific navigation forks and duplicated More menus.

## 2. Shared bottom navigation

Pages that participate in the shared game shell should reuse the shared dock/navigation behavior rather than create private copies.

The current shared `More` behavior is owned by `GameDock` and should remain a single shared implementation.

The `More` panel currently contains only:

- Settings
- Save

Do not duplicate destinations such as Daily, Mail, Shop, Enhance, Craft, Raid, Arena, Leaderboard, Switch Character, or Logout inside the shared More panel unless a new user-approved navigation contract explicitly adds them.

## 3. Pages using shared More behavior

Current production coverage includes the major Character, Inventory, Pet, and Map flows. These pages should preserve shared non-navigating More behavior rather than using page-specific toggle/close behavior.

If a new page joins the common shell, reuse the existing shared navigation component first.

## 4. Settings responsibility

Settings is the account/security hub and currently exposes the account/security actions and information required by the app, including:

- Player ID
- Recovery Code
- password-change entry point
- Switch Character
- Logout

Account/security actions must continue to use the current auth/session contract in `LOGIN-AUTH-V2.md`.

Do not move account/security actions into unrelated navigation menus without explicit approval.

## 5. Return-flow contract

Opening Character, Pet, utility, or related overlays/pages must preserve the originating phase so Back returns the user to the correct previous context.

Current implementation has dedicated return-phase state for Character, Pet, utility, and Gacha flows. Do not replace these with a hard-coded destination unless explicitly approved.

Navigation fixes must be checked from every supported entry path, not only from Main Hub.

## 6. Mobile and responsive rules

Navigation is mobile-first.

Shared navigation must:

- respect safe areas
- keep touch targets usable after responsive scaling
- avoid overlap with page content
- keep active-state behavior consistent
- preserve visible labels/icons as approved for the current page shell

A responsive fix must not scale the page while leaving navigation hit areas or visual assets at incompatible sizes.

## 7. Change boundaries

A navigation/settings task must not silently change:

- gameplay rules
- destination page internals
- authentication/security semantics
- save semantics
- economy or rewards

If a destination is removed from one menu because it exists elsewhere, verify the remaining route is reachable before removing the duplicate.

## 8. Verification

For navigation/settings changes, verify:

- shared More panel remains singular
- Settings and Save work from every page using the shared dock
- Character / Inventory / Pet / Map flows use intended shared behavior
- Back returns to the correct origin phase
- Switch Character and Logout route correctly
- Recovery Code remains visible where intended
- safe-area, overflow, touch target, and responsive behavior on mobile
- no duplicate menu items were introduced

`tests/navigation-settings.test.js` is a production contract test and should be updated only when an approved navigation contract intentionally changes.

## 9. Maintenance

Update this document when an approved shared navigation or Settings contract changes. Page-specific visual redesigns do not automatically authorize navigation behavior changes.
