# Current State

## 2026-08-11 17.2 菜单英文兼容显示名
- 数据模型新增 `compatibilityLabel`：ATM 方案的 `label` 继续保存中文原名，17.2 及更早版本生成 IL 时使用用户确认的可打印 ASCII 显示名，17.4 继续使用中文原名。
- 菜单编辑器在 17.2 中文项上将兼容名标为必填并阻止非法保存；预览、可信 Apply Plan 和旧兼容入口统一传入活动 Allegro 版本，避免预览与实际写入不一致。
- 验证：菜单生成、Renderer 表单和临时 pcbenv GBK IL/UTF-8 JSON 定向测试共 25 项通过；完整门禁 69 个测试文件 / 412 项、双端类型检查与生产构建全绿。当前真实 17.2 配置已通过 Apply Plan 写入英文标签，视觉结果待会话加载确认。

## 2026-08-11 17.2 中文动态菜单限制确认与实验回滚
- 实机证据：17.2 当前 `generated_menu.il` 中“器件”为 GBK 字节 `C6 F7 BC FE`，运行菜单显示为 `Æ÷¼þ`；这与此前 17.2 启动脚本必须用 GBK 的路径证据形成职责差异。
- 根因：17.2 SKILL 加载器要求 GBK，而 `axlUIMenuInsert` 所在 UI 路径不支持 Unicode；GBK、UTF-8 整体脚本和 UTF-8 八进制字节会分别产生不同乱码。
- 处理：两个编码实验均已通过 Apply Plan 撤销；最终实现采用独立 ASCII `compatibilityLabel`，不再尝试对中文标签转码。
- 验证：同一台 17.2 S083 实机完成三种字节路径对照；完整门禁 68 个测试文件 / 407 项此前已通过，回滚后代码与测试恢复基线。当前会话的重复菜单需执行 `skill (atmDeleteMenus)` 或重启清理。

## 2026-08-11 17.2 加载 17.4 遗留菜单回归修复
- 实机证据：运行进程是 17.2，但 Windows `HOME/CDSROOT` 指向 17.4；17.2 已保存 `MySkill` 草稿却没有派生 IL/bootstrap，17.4 则仍有 7 月 GBK“测试”菜单，字节与截图 `²âÊÔ` 一致。
- 根因：侧栏隔离启动入口曾被移除，用户只能从桌面启动 17.2，进程继续继承 17.4 HOME；同时草稿保存不等于执行菜单 Apply Plan。
- 修复：环境列表返回只读主机 HOME/CDSROOT；侧栏恢复“按此环境启动”并显示错配警告；菜单应用结果明确要求关闭旧窗口并从 ATM 启动。
- 验证：环境切换/启动、Allegro 启动规格、菜单工作区共 9 项测试通过，前后端 TypeScript 检查通过；真实 17.2 新会话仍需用户从新入口启动后确认。
- 发布：v0.3.3 已公开为 GitHub Latest，exe、blockmap、latest.yml 三项资产齐全；更新元数据版本与安装包路径均为 0.3.3。CI 行尾误判已修复并全绿。
- 发布脚本后续改为 electron-builder 只打包、gh 串行上传，避免 exe/blockmap 并发创建重复草稿；完整门禁 68 个测试文件 / 407 项通过。

## 2026-08-11 菜单页面导航丢失草稿修复
- 根因：侧栏 `NavLink` 直接卸载 `MenuPage`，未调用已有菜单草稿保存保护。
- 修复：侧栏导航和菜单页内关联 Skill/快捷键跳转统一先执行 `environmentSwitchGuard`；保存失败时阻止导航。
- 验证：前端/后端 TypeScript 检查通过；导航保护、环境保护、菜单工作区与菜单管理专项测试共 24 项通过。

## 2026-08-10 应用内更新无反馈修复
- 根因：发布前本地 0.3.0 没有内置 feed，且 `UpdateService.check()` 在 feed 为空时直接返回旧状态；本机没有 `update-settings.json`。
- 修复：更新源增加 ATM 官方 GitHub Release 兜底，检查时立即显示连接状态并设置 30 秒超时；版本提升为 0.3.1。
- v0.3.1 已公开为 GitHub Latest Release，exe/blockmap/latest.yml 三项资产齐全；安装包 SHA-256 为 `BE39D38CF367D20C70B81DA9EFDA35D529C2D2D441FEA040837F19160CE3376D`。

## 2026-08-10 菜单保存与跨环境复制修复
- 实机配置确认：17.4 的“测试”方案仍有 6 项；17.2 的“默认菜单方案”和“副本”均为空，数据未删除而是环境隔离。
- 菜单方案 CRUD/切换后统一同步编辑状态；切换方案或 Allegro 环境前先保存草稿，失败时阻止切换；关闭/强制刷新有未保存提醒。
- 当前环境为空时可从蓝色提示生成“复制到当前环境”可信 Apply Plan，只复制非空菜单源方案为独立草稿，不立即修改 Allegro。
- `menu_profile.json` 改为临时文件原子替换，CRUD 不再忽略保存失败。

## 2026-08-10 环境控件行为调整（已由 2026-08-11 修复取代）
- “切换环境”仍只切换 ATM 管理目标；因桌面启动器会继承错误 HOME，侧栏已恢复独立的“按此环境启动”入口。

## Snapshot
- 2026-08-09：确认真实 17.2 会把 UTF-8 `allegro.ilinit` 按 CP936/GBK 读取，中文路径因此变成“甯冨眬”并加载失败；脚本实现 17.2=GBK、17.4=UTF-8，菜单标签额外使用 UTF-8 字节八进制转义。
- 2026-08-09：定位到“打开 17.2 仍显示 17.4 乱码菜单”的根因是 Windows `HOME/CDSROOT` 仍指向 17.4；新增按所选环境隔离启动链路与 HOME 不匹配告警。定向测试和前后端类型检查通过，17.2 实机仍待复测。
- Last updated: 2026-08-11
- Current branch: master；v0.3.1 已发布，应用内检查更新无反馈、统一工作区安全与一致性缺陷已修复
- App status: 七个侧栏入口（统一工作区/快捷键/Skill/菜单/配色/备份与恢复/系统状态）；工作区支持环境与四类方案绑定、复制、预览和顺序应用；配色支持捕获、自定义颜色、应用预览与撤销
- Test status: 69 files / 412 tests pass；新增工作区目标固定、确认前环境复检、原子持久化、可信 Apply Plan、绑定配置、动态桥接路径、菜单保存/跨环境复制/切换保护、17.2 英文兼容显示名、菜单双栏滚动、菜单拖拽 protected-mode/相邻换位、环境按版本唯一/陈旧关系清理、版本编码策略、官方更新源兜底和检查超时覆盖
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
- Menu、Skill Profile、Skill Toggle 和 Vibe Bridge 脚本按环境版本标注 Allegro 文本编码；17.2 菜单标签使用用户确认的 ASCII 兼容名，17.4 使用中文原名；旧 UTF-8/GBK 脚本可自动识别，JSON 与历史记录保持 UTF-8。

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
