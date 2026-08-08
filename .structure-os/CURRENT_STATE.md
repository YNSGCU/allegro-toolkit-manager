# Current State

## Snapshot
- Last updated: 2026-08-08
- Current branch: master；v0.3.0 Beta 收口中，最近提交为配色预览/撤销与备份恢复测试
- App status: 六个侧栏入口（快捷键/Skill/菜单/配色/备份与恢复/系统状态）；配色支持捕获、单层自定义颜色、应用预览与一键撤销；设置支持 .atmbak 备份/分区恢复；窗口状态持久化；IPC 通道注册表自检
- Test status: 60 files / 353 tests pass；覆盖配色预览与撤销、备份分区隔离、窗口状态、环境注册、Apply Plan 环境锁
- Validation status: security audit, ESLint, Prettier, 前后端 TypeScript, 全量测试, renderer build, `npm run verify` 全绿, Windows 解包版生成；生产路由/资源/asar 巡检通过；Electron 窗口级实机与真实 Allegro 写入仍需桌面会话手动确认

## Implemented Behavior

- Environment page locates and inspects Allegro config paths.
- Hotkey page supports layered visualization, conflict checks, profile preview/application, import/export, and change history.
- Hotkey navigation uses three focused tasks: Key shows the keyboard only, List owns search/table/selection details, and Conflict handles diagnostics. Import/export/history/env tools open from a workspace utility dialog; legacy subroutes redirect safely.
- Hotkey uses a compact top stack: the redundant eyebrow is removed, profile and runtime status share one row on wide windows, and each task title/description/action stays on one toolbar line.
- Hotkey add/edit dialogs provide keyboard-accessible command suggestions from the built-in dictionary and current workspace. Physical key M seeds `move`; Chinese names and descriptions are searchable, while unknown commands remain explicitly unverified.
- Hotkey editing now applies a source capability contract: writable env lines edit type/key/command, profile bindings also edit enabled/note, and reference/default/Skill-direct bindings remain read-only. Plans reject duplicates, stale files and zero-step execution.
- Skill page supports scanning, metadata inspection, impact analysis, loader/order checks, and skill profiles.
- Skill page now uses a compact workspace with a dense independently scrollable table, command/diagnostic views, a proportional detail inspector without decorative avatars, truthful diagnostic state and an in-page profile Apply Plan confirmation chain.
- Multi-file Skill subdirectories are now represented as one directory package; loader/main entry selection, aggregate command parsing and recursive static load-chain detection prevent internal modules from appearing as separate unloaded Skills.
- Menu page supports tree editing, validation, preview generation, linked command selection, and Apply Plan.
- Menu uses the tree editor as its only persistent workspace; command/reference views are contextual utilities, and its primary CTA is derived from dirty/unapplied/applied state.
- Shared UI foundations now provide tokens, shell, workspace header, status strip, page states and a unified Apply Plan dialog.
- 共享单行输入控件统一使用 13px 字号、1.4 行高和 10px 水平内边距；占位文字继承控件排版并保持明确的不透明度，搜索框与快捷键物理键输入不再出现文字过小或垂直漂移。
- 可见正文最小字号统一为 12px；快捷键键盘保持固定字号并在必要时内部滚动，不再整体缩放文字。
- ProfileBar 只常驻方案选择、方案管理和必要的审阅动作；已应用是状态文字，正常状态条合并展示。
- Renderer 错误通过 `src/shared/ui/feedback/formatUserError.ts` 转换为用户可理解的中文提示，不再暴露 IPC/JavaScript 内部术语。
- Hotkey data loading is isolated in `src/services/loadHotkeyWorkspaceData.ts`; the obsolete `HotkeyPage.tsx` UI was removed.
- Hotkey contained workspace now owns vertical scrolling; upper keyboard rows open hover cards downward, empty profiles cannot be applied, and failed loading remains “尚未检查”.
- Sidebar exposes one System Status entry; the environment route remains available from that dashboard for compatibility and detail inspection.
- `src/App.tsx` keeps the shell eager and loads all five page modules with `React.lazy()` under shared Suspense/error boundaries; navigation hover/focus preloads the shared route loader, and renderer entry JS remains 246.60kB without the old 500kB warning.
- Route and data failures expose direct recovery actions; Hotkey child-route switches retain their parent workspace state.
- Core Confirm, Apply Plan and Menu Preview dialogs trap focus, close with Escape when safe, and restore focus to their trigger.
- Add/Edit Hotkey, Skill metadata/impact and Menu command selector now share `BusinessDialog`; layout inline styles and legacy modal shells were removed from these five components.
- Windows x64 packaged app launches successfully; NSIS output is generated under `release/`.
- Legacy Skill toggle/delete plans are materialized into the unified transaction engine; unsupported move/archive protocols fail explicitly instead of reporting false success.
- Unified Apply Plan history and legacy hotkey history use separate files to prevent schema corruption.
- A real Allegro 17.4 session smoke opened a temporary copy of `unnamed.brd`, loaded Vibe Bridge, and returned `allegro`, `17.4-2019 S039`, design dbid `000001EA26BE8EC0`, and `1 design unit = 1 mil = 0.0254 mm`; the source/copy SHA-256 remained identical and all temporary artifacts were removed.

## Partial or Broken Behavior

- Structure OS CLI is not installed locally, so governance validation is file-based only.
- Public release signing is incomplete: the project icon is configured, but publisher identity is generic and the Windows installer is unsigned.

## Recently Changed Areas

- `src/shared/ui/`, `src/components/Layout.tsx`: design tokens, app shell and shared workspace contract
- `src/shared/ui/feedback/formatUserError.ts`: renderer-facing Chinese error normalization
- `src/components/{KeyboardVisualizer,ProfileBar,MenuTree,MenuTreeAddBar,SkillDetailSidebar}.tsx`: fixed typography, progressive disclosure, truthful state and action-density cleanup
- `src/pages/{DashboardPage,EnvironmentPage,HotkeyWorkspacePage,SkillPage,MenuPage}.tsx`: five-page UI reset
- `src/services/loadHotkeyWorkspaceData.ts`: hotkey read orchestration extracted from the deleted legacy page
- `src/App.tsx`, `src/config/routePageLoaders.ts`, `src/components/Layout.tsx`: recoverable route loading and navigation preloading
- `src/shared/ui/{feedback/RouteErrorBoundary,overlays/useDialogFocus}.tsx`: route recovery and dialog keyboard contract
- `src/shared/ui/overlays/BusinessDialog.tsx`, `src/shared/ui/foundations/dialogs.css`: shared business dialog and compact form contract
- `src/components/{AddHotkeyDialog,HotkeyEditor,SkillMetaDialog,SkillDeleteImpactDialog,CommandSelector}.tsx`: first cross-domain dialog migration
- `src/components/HotkeyCommandAssist.tsx`, `src/utils/hotkeyCommandSuggestions.ts`: command combobox and renderer-safe suggestion model
- `core/apply/hotkeyEditPlan.ts`, `electron/ipc/hotkey.ipc.ts`: real env/Profile edit plans, precondition checks, backup, rollback and refresh chain
- `src/components/hotkeys/{HotkeyEditorPanel,HotkeySubnav,hotkeyWorkspaceSections}.tsx`: standalone Hotkey list route and three-task navigation
- `tests/{rendererAssetPath,routeExperience,layoutPrefetch,dialogAccessibility}.test.tsx`: route/build/focus regression coverage
- `tests/businessDialogs.test.tsx`: labelled forms, error announcement, risk options, command search and initial-focus coverage
- `docs/dev/features/workspace-ui-architecture.md`, `docs/user/features/workspace-ui.md`: developer and user documentation

## Open Questions

- Should the remaining legacy inline styles in deep feature dialogs be migrated into domain CSS modules in a dedicated cleanup?
- Which complex macro templates from the supplied reference should be promoted after Allegro-version-specific runtime verification?