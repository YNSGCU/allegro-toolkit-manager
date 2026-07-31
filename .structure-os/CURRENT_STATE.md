# Current State

## Snapshot

- Last updated: 2026-08-01
- Current branch: Git repository initialized; UI reset baseline commit `c95a222`
- App status: five routed pages use the shared workspace UI contract；2026-08-01 完成快捷键页滚动链、悬浮卡方向、标题层级、字号与真实状态收口；写入安全和 IPC 边界不变
- Test status: 35 files / 202 tests pass；固定字号键盘、边缘角标安全区、悬浮卡方向、无方案和加载失败状态已有回归覆盖
- Validation status: frontend TypeScript, Electron TypeScript and renderer production build pass

## Implemented Behavior

- Environment page locates and inspects Allegro config paths.
- Hotkey page supports layered visualization, conflict checks, profile preview/application, import/export, and change history.
- Skill page supports scanning, metadata inspection, impact analysis, loader/order checks, and skill profiles.
- Skill page now uses a compact workspace with a dense independently scrollable table, command/diagnostic views, a proportional detail inspector without decorative avatars, truthful diagnostic state and an in-page profile Apply Plan confirmation chain.
- Multi-file Skill subdirectories are now represented as one directory package; loader/main entry selection, aggregate command parsing and recursive static load-chain detection prevent internal modules from appearing as separate unloaded Skills.
- Menu page supports tree editing, validation, preview generation, linked command selection, and Apply Plan.
- Shared UI foundations now provide tokens, shell, workspace header, status strip, page states and a unified Apply Plan dialog.
- 可见正文最小字号统一为 12px；快捷键键盘保持固定字号并在必要时内部滚动，不再整体缩放文字。
- ProfileBar 只保留一个真实的应用状态；菜单和 Skill 的空状态、错误状态、工具栏与剩余高度滚动链已统一。
- Renderer 错误通过 `src/shared/ui/feedback/formatUserError.ts` 转换为用户可理解的中文提示，不再暴露 IPC/JavaScript 内部术语。
- Hotkey data loading is isolated in `src/services/loadHotkeyWorkspaceData.ts`; the obsolete `HotkeyPage.tsx` UI was removed.
- Hotkey contained workspace now owns vertical scrolling; upper keyboard rows open hover cards downward, empty profiles cannot be applied, and failed loading remains “尚未检查”.
- Overview and Environment are operating dashboards with explicit loading/error states instead of MinimalSurface landing cards.

## Partial or Broken Behavior

- Structure OS CLI is not installed locally, so governance validation is file-based only.
- Route-level code splitting remains pending; Vite reports a non-blocking main-chunk size warning above 500kB.

## Recently Changed Areas

- `src/shared/ui/`, `src/components/Layout.tsx`: design tokens, app shell and shared workspace contract
- `src/shared/ui/feedback/formatUserError.ts`: renderer-facing Chinese error normalization
- `src/components/{KeyboardVisualizer,ProfileBar,MenuTree,MenuPreviewDialog}.tsx`: fixed typography, relative hover-card placement, truthful state and icon/CSS cleanup
- `src/pages/{DashboardPage,EnvironmentPage,HotkeyWorkspacePage,SkillPage,MenuPage}.tsx`: five-page UI reset
- `src/services/loadHotkeyWorkspaceData.ts`: hotkey read orchestration extracted from the deleted legacy page
- `docs/dev/features/workspace-ui-architecture.md`, `docs/user/features/workspace-ui.md`: developer and user documentation

## Open Questions

- Should route-level dynamic imports be introduced to remove the current Vite chunk-size warning?
- Should the remaining legacy inline styles in deep feature dialogs be migrated into domain CSS modules in a dedicated cleanup?
