# Module Map

## Top-Level Areas

| Path | Responsibility | Notes |
|---|---|---|
| `core/` | Pure business logic, parsing, validation, generation, backups, profiles, menu management | Testable with Vitest |
| `electron/` | Electron main process, preload bridge, IPC registration and orchestration | Imports `core/` and shared `src/types/` |
| `src/` | Renderer pages, UI components, services, shared UI foundations, hooks, utilities, and shared renderer types | Uses `window.atm.*` bridge |
| `docs/` | Product manuals and governance docs | Chinese manuals plus Structure OS docs |

## Current Boundary Notes

- Renderer now has a stable `src/shared/ui/` foundation and `src/services/` read-orchestration layer; feature components remain in `components/` pending later module-domain migration.
- `src/config/routePageLoaders.ts` owns route module loaders and root boundary keys; `src/App.tsx` consumes them for lazy loading while `Layout` reuses them for hover/focus preloading.
- `src/App.tsx` owns route-level Suspense/error boundaries: the shell remains eager, while the five page modules are emitted as independent recoverable chunks.
- Routed pages import shared workspace primitives from `src/shared/ui/index.ts`.
- Electron main/preload own the bridge layer; renderer does not access Node APIs directly.

## Feature Chains

### Environment Detection

`src/pages/EnvironmentPage.tsx` -> `window.atm.locateEnvironment()` -> `electron/preload.ts` -> `electron/ipc/env.ipc.ts` -> `core/environment/locateEnvironment.ts`

### Hotkey Management

`src/pages/HotkeyWorkspacePage.tsx` -> `src/services/loadHotkeyWorkspaceData.ts` -> `window.atm.*hotkey/profile/history methods*` -> `electron/preload.ts` -> `electron/ipc/hotkey.ipc.ts` / `history.ipc.ts` -> `core/parser/*`, `core/validator/*`, `core/apply/*`, `core/profile/*`

### Shared Workspace UI

`src/main.tsx` -> `src/App.tsx` (`Layout` + `Suspense` + `RouteErrorBoundary`) -> `src/config/routePageLoaders.ts` -> route-specific page chunk -> `src/shared/ui/{workspace,feedback,overlays}`. `Layout` preloads the same route loader on link hover/focus. `ApplyPlanDialog` is shared by Hotkey, Skill and Menu while plan generation/execution remains feature-owned.

对话框焦点链：触发控件 -> `src/shared/ui/overlays/useDialogFocus.ts` -> 初始焦点 / Tab 循环 / Escape -> 关闭后恢复触发控件。Apply Plan 执行中通过 `dismissDisabled` 禁止退出。

用户错误链：页面捕获异常 -> `src/shared/ui/feedback/formatUserError.ts` -> 中文可恢复提示。该层只处理展示文案，不吞掉日志，也不改变 IPC 响应协议。

快捷键键盘由 `src/components/KeyboardVisualizer.tsx` 以固定字号渲染；空间不足时只滚动 `.keyboard-visualizer-wrapper`，不再经过独立的 viewport 缩放模块。

### Skill Management

`src/pages/SkillPage.tsx` -> `SkillWorkspaceTable` / `SkillDetailSidebar` -> `window.atm.*skill methods*` -> `electron/preload.ts` -> `electron/ipc/skill.*.ipc.ts` -> `core/skill/*`, `core/generator/generateSkillLoader.ts`, `core/validator/*`

Renderer responsibility: `SkillPage` owns orchestration and Apply Plan state; table/detail components render data and emit user intent without direct filesystem or IPC access.

Skill profile apply chain: `SkillPage` -> `skillProfileCreateApplyPlan/skillProfileExecuteApplyPlan` -> `electron/ipc/skill.profile.ipc.ts` -> unified `core/apply/applyPlanEngine.ts` -> backups/history/filesystem -> rescan.

### Menu Management

`src/pages/MenuPage.tsx` -> `window.atm.*menu methods*` -> `electron/preload.ts` -> `electron/ipc/menu.ipc.ts` -> `core/menu/*`, `core/apply/*`
