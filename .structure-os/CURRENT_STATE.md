# Current State

## Snapshot

- Last updated: 2026-08-01
- Current branch: Git repository initialized; UI reset baseline commit `c95a222`
- App status: 四个侧栏入口使用共享工作区 UI；五个业务页面已按路由拆包并支持悬停/焦点预加载、路由错误恢复；核心对话框具备完整键盘焦点管理；写入安全和 IPC 边界不变
- Test status: 39 files / 211 tests pass；包含页面懒加载与预加载、路由错误恢复、对话框焦点、方案栏、快捷键双视图、Skill 三类详情和菜单单一树工作台契约覆盖
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
- `src/App.tsx` keeps the shell eager and loads all five page modules with `React.lazy()` under shared Suspense/error boundaries; navigation hover/focus preloads the shared route loader, and renderer entry JS remains 246.60kB without the old 500kB warning.
- Route and data failures expose direct recovery actions; Hotkey child-route switches retain their parent workspace state.
- Core Confirm, Apply Plan and Menu Preview dialogs trap focus, close with Escape when safe, and restore focus to their trigger.

## Partial or Broken Behavior

- Structure OS CLI is not installed locally, so governance validation is file-based only.

## Recently Changed Areas

- `src/shared/ui/`, `src/components/Layout.tsx`: design tokens, app shell and shared workspace contract
- `src/shared/ui/feedback/formatUserError.ts`: renderer-facing Chinese error normalization
- `src/components/{KeyboardVisualizer,ProfileBar,MenuTree,MenuTreeAddBar,SkillDetailSidebar}.tsx`: fixed typography, progressive disclosure, truthful state and action-density cleanup
- `src/pages/{DashboardPage,EnvironmentPage,HotkeyWorkspacePage,SkillPage,MenuPage}.tsx`: five-page UI reset
- `src/services/loadHotkeyWorkspaceData.ts`: hotkey read orchestration extracted from the deleted legacy page
- `src/App.tsx`, `src/config/routePageLoaders.ts`, `src/components/Layout.tsx`: recoverable route loading and navigation preloading
- `src/shared/ui/{feedback/RouteErrorBoundary,overlays/useDialogFocus}.tsx`: route recovery and dialog keyboard contract
- `tests/{rendererAssetPath,routeExperience,layoutPrefetch,dialogAccessibility}.test.tsx`: route/build/focus regression coverage
- `docs/dev/features/workspace-ui-architecture.md`, `docs/user/features/workspace-ui.md`: developer and user documentation

## Open Questions

- Should the remaining legacy inline styles in deep feature dialogs be migrated into domain CSS modules in a dedicated cleanup?
