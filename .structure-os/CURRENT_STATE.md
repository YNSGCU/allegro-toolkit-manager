# Current State

## 2026-08-10 应用内更新无反馈修复
- 根因：发布前本地 0.3.0 没有内置 feed，且 `UpdateService.check()` 在 feed 为空时直接返回旧状态；本机没有 `update-settings.json`。
- 修复：更新源增加 ATM 官方 GitHub Release 兜底，检查时立即显示连接状态并设置 30 秒超时；版本提升为 0.3.1。
- v0.3.0 Release 已公开且 exe/blockmap/latest.yml 齐全；v0.3.1 完整验证已通过，打包与发布待执行。

## 2026-08-10 菜单保存与跨环境复制修复
- 实机配置确认：17.4 的“测试”方案仍有 6 项；17.2 的“默认菜单方案”和“副本”均为空，数据未删除而是环境隔离。
- 菜单方案 CRUD/切换后统一同步编辑状态；切换方案或 Allegro 环境前先保存草稿，失败时阻止切换；关闭/强制刷新有未保存提醒。
- 当前环境为空时可从蓝色提示生成“复制到当前环境”可信 Apply Plan，只复制非空菜单源方案为独立草稿，不立即修改 Allegro。
- `menu_profile.json` 改为临时文件原子替换，CRUD 不再忽略保存失败。

## 2026-08-10 环境控件行为调整
- 左下角 Allegro 环境控件改为“选择版本 -> 点击切换环境”，只切换 ATM 的活动管理目标并刷新页面，不再从该控件启动 Allegro。
- 已打开的 Allegro 进程与 Windows 全局 `HOME/CDSROOT` 不受影响；需要启动时使用对应版本的独立启动器。

## Snapshot
- 2026-08-09：确认真实 17.2 会把 UTF-8 `allegro.ilinit` 按 CP936/GBK 读取，中文路径因此变成“甯冨眬”并加载失败；已实现 17.2=GBK、17.4=UTF-8 的版本编码策略、旧文件自动识别及 Apply Plan 安全转码，等待真实会话重启复测。
- 2026-08-09：定位到“打开 17.2 仍显示 17.4 乱码菜单”的根因是 Windows `HOME/CDSROOT` 仍指向 17.4；新增按所选环境隔离启动链路与 HOME 不匹配告警。定向测试和前后端类型检查通过，17.2 实机仍待复测。
- Last updated: 2026-08-11
- Current branch: master；v0.3.0 Beta 收口中，统一工作区安全与一致性缺陷已修复（尚未提交）
- App status: 七个侧栏入口（统一工作区/快捷键/Skill/菜单/配色/备份与恢复/系统状态）；工作区支持环境与四类方案绑定、复制、预览和顺序应用；配色支持捕获、自定义颜色、应用预览与撤销
- Test status: 67 files / 403 tests pass；新增工作区目标固定、确认前环境复检、原子持久化、可信 Apply Plan、绑定配置、动态桥接路径、菜单保存/跨环境复制/切换保护、菜单双栏滚动、菜单拖拽 protected-mode/相邻换位、环境按版本唯一/陈旧关系清理、版本编码策略、官方更新源兜底和检查超时覆盖
- Validation status: security audit, ESLint, Prettier, 前后端 TypeScript, 全量测试, renderer build, `npm run verify` 全绿, Windows 解包版生成；生产路由/资源/asar 巡检通过；Electron 窗口级实机与真实 Allegro 写入仍需桌面会话手动确认

## Implemented Behavior

- 统一工作区新建后自动进入绑定配置；可按目标环境选择快捷键/Skill/菜单方案并选择全局配色方案，也可复制和重新配置现有工作区。
- 工作区应用固定用户点击的目标对象，确认前再次校验环境锁与模块存在性；环境为空、漂移或计划变化时停止执行并要求重新审阅。
- 工作区 JSON 使用临时文件原子替换，保存失败不再假成功；默认工作区和当前使用中的工作区不可删除。
- Menu、Skill Profile 与 Vibe Bridge Apply Plan 使用主进程一次性可信快照，拒绝 Renderer 篡改、跨作用域复用和重复执行。
- Menu 树与属性面板恢复为确定高度双栏并各自滚动，删除等底部操作不再被 contained 页面裁切。
- Menu 拖放状态由整棵树共享，不依赖 Chromium `dragover` 读取 DataTransfer；同级项目向上或向下拖动都会实际换位，并显示目标行反馈。
- 环境下拉框按 Allegro 版本唯一；同版本多个 `pcbenv` 候选优先保留当前选择，否则优先版本安装目录配置。刷新会重建共享关系并移除已消失的自动记录。
- 配色页手动桥接命令使用运行时发现的 `serverFile`，不再包含开发机用户名；空状态不再重复展示捕获按钮。
- Menu、Skill Profile、Skill Toggle 和 Vibe Bridge 计划按环境版本标注 Allegro 文本编码；旧 UTF-8/GBK 脚本可自动识别，JSON 与历史记录保持 UTF-8。

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
- 新增隔离启动尚未在真实 Allegro 17.2 会话确认；旧窗口与桌面快捷方式仍会继承全局 `HOME/CDSROOT`。

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
- 菜单页现可识别“活动环境为空、其他环境有数据”和“源 JSON 为空但 ATM 备份可恢复”，恢复必须经过可信 Apply Plan；菜单 IL 已改为 UTF-8。目标 Allegro 17.4 的中文运行时显示仍待用户实机确认。
