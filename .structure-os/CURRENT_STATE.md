# Current State

## Snapshot

- Last updated: 2026-08-01
- Current branch: Git repository initialized; UI reset baseline commit `c95a222`
- App status: 四个侧栏入口使用共享工作区 UI；五个业务页面已按路由拆包，快捷键、Skill、菜单完成渐进披露与单一主操作收口；写入安全和 IPC 边界不变
- Test status: 36 files / 206 tests pass；包含页面懒加载、方案栏、快捷键双视图、Skill 三类详情和菜单单一树工作台契约覆盖
- Validation status: frontend TypeScript, Electron TypeScript and renderer production build pass

## Implemented Behavior

- Environment page locates and inspects Allegro config paths.
- Hotkey page supports layered visualization, conflict checks, profile preview/application, import/export, and change history.
- Hotkey navigation is reduced to Key/Conflict; keyboard, search/list and detail share one task page, while import/export/history/env tools open from a workspace utility dialog. Legacy subroutes redirect safely.
- Skill page supports scanning, metadata inspection, impact analysis, loader/order checks, and skill profiles.
- Skill page now uses a compact workspace with a dense independently scrollable table, command/diagnostic views, a proportional detail inspector without decorative avatars, truthful diagnostic state and an in-page profile Apply Plan confirmation chain.
- Multi-file Skill subdirectories are now represented as one directory package; loader/main entry selection, aggregate command parsing and recursive static load-chain detection prevent internal modules from appearing as separate unloaded Skills.
- Menu page supports tree editing, validation, preview generation, linked command selection, and Apply Plan.
- Menu uses the tree editor as its only persistent workspace; command/reference views are contextual utilities, and its primary CTA is derived from dirty/unapplied/applied state.
- Shared UI foundations now provide tokens, shell, workspace header, status strip, page states and a unified Apply Plan dialog.
- 可见正文最小字号统一为 12px；快捷键键盘保持固定字号并在必要时内部滚动，不再整体缩放文字。
- ProfileBar 只常驻方案选择、方案管理和必要的审阅动作；已应用是状态文字，正常状态条合并展示。
- Renderer 错误通过 `src/shared/ui/feedback/formatUserError.ts` 转换为用户可理解的中文提示，不再暴露 IPC/JavaScript 内部术语。
- Hotkey data loading is isolated in `src/services/loadHotkeyWorkspaceData.ts`; the obsolete `HotkeyPage.tsx` UI was removed.
- Hotkey contained workspace now owns vertical scrolling; upper keyboard rows open hover cards downward, empty profiles cannot be applied, and failed loading remains “尚未检查”.
- Sidebar exposes one System Status entry; the environment route remains available from that dashboard for compatibility and detail inspection.
- `src/App.tsx` keeps the shell eager and loads all five page modules with `React.lazy()` under a shared `Suspense` fallback; renderer entry JS dropped from 556.55kB to 244.78kB.

## Partial or Broken Behavior

- Structure OS CLI is not installed locally, so governance validation is file-based only.

## Recently Changed Areas

- `src/shared/ui/`, `src/components/Layout.tsx`: design tokens, app shell and shared workspace contract
- `src/shared/ui/feedback/formatUserError.ts`: renderer-facing Chinese error normalization
- `src/components/{KeyboardVisualizer,ProfileBar,MenuTree,MenuTreeAddBar,SkillDetailSidebar}.tsx`: fixed typography, progressive disclosure, truthful state and action-density cleanup
- `src/pages/{DashboardPage,EnvironmentPage,HotkeyWorkspacePage,SkillPage,MenuPage}.tsx`: five-page UI reset
- `src/services/loadHotkeyWorkspaceData.ts`: hotkey read orchestration extracted from the deleted legacy page
- `src/App.tsx`, `tests/rendererAssetPath.test.ts`: route-level lazy loading and build-boundary regression coverage
- `docs/dev/features/workspace-ui-architecture.md`, `docs/user/features/workspace-ui.md`: developer and user documentation

## Open Questions

- Should the remaining legacy inline styles in deep feature dialogs be migrated into domain CSS modules in a dedicated cleanup?
