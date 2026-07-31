# Module Map

## Top-Level Areas

| Path | Responsibility | Notes |
|---|---|---|
| `core/` | Pure business logic, parsing, validation, generation, backups, profiles, menu management | Testable with Vitest |
| `electron/` | Electron main process, preload bridge, IPC registration and orchestration | Imports `core/` and shared `src/types/` |
| `src/` | Renderer pages, UI components, hooks, utilities, and shared renderer types | Uses `window.atm.*` bridge |
| `docs/` | Product manuals and governance docs | Chinese manuals plus Structure OS docs |

## Current Boundary Notes

- Current project shape is functional but not yet migrated to the recommended `pages/modules/shared/infra` split.
- Renderer pages import directly from `components/`, `hooks/`, `utils/`, and `types/`.
- Electron main/preload own the bridge layer; renderer does not access Node APIs directly.

## Feature Chains

### Environment Detection

`src/pages/EnvironmentPage.tsx` -> `window.atm.locateEnvironment()` -> `electron/preload.ts` -> `electron/ipc/env.ipc.ts` -> `core/environment/locateEnvironment.ts`

### Hotkey Management

`src/pages/HotkeyPage.tsx` -> `window.atm.*hotkey/profile/history methods*` -> `electron/preload.ts` -> `electron/ipc/hotkey.ipc.ts` / `history.ipc.ts` -> `core/parser/*`, `core/validator/*`, `core/apply/*`, `core/profile/*`

### Skill Management

`src/pages/SkillPage.tsx` -> `SkillWorkspaceTable` / `SkillDetailSidebar` -> `window.atm.*skill methods*` -> `electron/preload.ts` -> `electron/ipc/skill.*.ipc.ts` -> `core/skill/*`, `core/generator/generateSkillLoader.ts`, `core/validator/*`

Renderer responsibility: `SkillPage` owns orchestration and Apply Plan state; table/detail components render data and emit user intent without direct filesystem or IPC access.

Skill profile apply chain: `SkillPage` -> `skillProfileCreateApplyPlan/skillProfileExecuteApplyPlan` -> `electron/ipc/skill.profile.ipc.ts` -> unified `core/apply/applyPlanEngine.ts` -> backups/history/filesystem -> rescan.

### Menu Management

`src/pages/MenuPage.tsx` -> `window.atm.*menu methods*` -> `electron/preload.ts` -> `electron/ipc/menu.ipc.ts` -> `core/menu/*`, `core/apply/*`
