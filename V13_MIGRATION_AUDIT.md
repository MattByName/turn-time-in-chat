# Foundry VTT v13 migration audit for `turn-time-in-chat`

Date: 2026-05-05

This audit maps the current codebase to v13 API guidance and identifies the concrete upgrade work needed.

## 1) Manifest compatibility is still pinned to v12

- Current `module.json` sets `compatibility.minimum` and `compatibility.verified` to `12`.
- For a v13 release, this should be updated to target v13 and tested against a current v13 build.

Why this matters in v13:
- Foundry package compatibility controls whether users can install/enable the package on a given core version.

## 2) Legacy `Application` + jQuery patterns should be migrated to `ApplicationV2` patterns

- `CombatTimerApp` extends legacy `Application` and uses `activateListeners(html: JQuery)` plus jQuery selectors.
- v13 API emphasizes ApplicationV2/renderApplicationV2 and modern `HTMLElement`-driven app rendering.

What to change:
- Port `CombatTimerApp` to `foundry.applications.api.ApplicationV2`.
- Replace jQuery listener wiring with `element.querySelector(...)` and `addEventListener(...)`.
- Update render lifecycle methods to V2 equivalents.

## 3) Hook callback typings and signatures should be tightened for v13

- `Hooks.on('combatTurn', ...)` and `Hooks.on('combatRound', ...)` currently accept `any` for update payloads.
- v13 documents concrete parameter shapes for these hooks (round/turn and advanceTime/direction).

What to change:
- Replace `any` with explicit object types per v13 docs.
- Optionally add guards for undefined values when rewinding/ending turn order.

## 4) `renderCombatTracker` and `renderChatMessage` handlers rely on jQuery-centric DOM mutation

- Current implementation expects `html: JQuery` and calls `.find()`, `.css()`, and jQuery insertion helpers.
- v13 still supports many legacy hooks, but long-term direction is toward generic application hooks and V2 apps.

What to change:
- Use v13-friendly hook patterns and typed DOM elements.
- Reduce coupling to tracker internals (`.encounter-title`) that may shift in minor versions.
- Prefer idempotent insertion checks so the timer button is not duplicated across re-renders.

## 5) Error handling currently swallows failures and can hide v13 migration bugs

- `updateCombatFlag` and socket-side `setFlag` calls suppress errors (`catch` with empty body).

What to change:
- Log warning-level diagnostics when `setFlag` fails (combat deleted, permissions, schema mismatch).
- Keep non-blocking behavior, but surface enough context to debug v13 differences.

## 6) Type safety is very loose, which makes v13 breakages harder to detect

- Widespread `(game.settings as any).get(...)` and `as any` usage masks API changes.

What to change:
- Add a small typed settings accessor layer for module settings.
- Replace broad `any` casts with Foundry v13 types from `types/index.d.ts`.

## 7) Verify ESM/build output path assumptions for v13 packaging

- Source imports use explicit `.ts` suffixes, while manifest loads `index.js`.
- Confirm emitted JS imports are resolvable in the packaged module on Foundry's ESM loader.

What to change:
- Ensure TypeScript output rewrites/uses `.js` extensions in emitted imports.
- Add a build check on produced `index.js` before release zipping.

---

## Suggested execution order

1. Update manifest compatibility + release metadata.
2. Migrate `CombatTimerApp` to `ApplicationV2` and native DOM events.
3. Update hook handlers (`renderCombatTracker`, `renderChatMessage`) to typed, idempotent DOM logic.
4. Tighten typing for combat hooks/settings.
5. Add visible warning logging for failed async flag writes.
6. Run full test pass in Foundry v13 stable.

## Foundry references consulted

- v13 API index: https://foundryvtt.com/api/v13/index.html
- v13 hook events overview: https://foundryvtt.com/api/v13/modules/hookEvents.html
- v13 `combatTurn` hook signature: https://foundryvtt.com/api/v13/functions/hookEvents.combatTurn.html
- v13 release notes summary (v12 -> v13 change list): https://foundryvtt.com/releases/13.341
- API migration guides landing page: https://foundryvtt.com/article/migration/
