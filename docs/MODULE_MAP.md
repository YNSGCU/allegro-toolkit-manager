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

多版本链：`Layout/EnvironmentPage` -> `listAllegroEnvironments/setActiveAllegroEnvironment` -> `env:list-workspaces/env:set-active-workspace` -> `core/environment/environmentRegistry.ts` -> `%APPDATA%/AllegroToolkitManager/environments.json`。侧栏挂载时刷新环境，注册表清理已消失的自动记录、按版本归并为一个活动 `pcbenv`，再按最终路径重建共享关系；当前选择优先，没有当前选择时优先版本安装目录旁的 `SPB_Data/pcbenv`。`locateEnvironment()` 统一解析活动环境，快捷键、Skill、菜单 Apply Plan 生成时锁定 `environmentId + pcbenvPath`，执行前拒绝环境漂移。

环境切换链：`AllegroEnvironmentSwitcher` -> `setActiveAllegroEnvironment` -> `env:set-active-workspace` -> `core/environment/environmentRegistry.ts` -> `environments.json`。“切换环境”只改变 ATM 管理目标；同一控件的“按此环境启动”通过 `env:launch-workspace` -> `allegroLauncher.ts` 为新 Allegro 子进程注入匹配的 HOME/CDSROOT。环境列表还返回只读系统 HOME/CDSROOT，用于识别桌面快捷方式会加载错误配置的风险。

迁移链：`HotkeyProfileMigrationDialog` -> `profile:check-compatibility/profile:migrate` -> `core/environment/compatibility.ts` + `core/profile/hotkeyProfile.ts` -> 目标环境 `atm_generated/profiles`。

### Hotkey Management

`src/pages/HotkeyWorkspacePage.tsx` -> `src/services/loadHotkeyWorkspaceData.ts` -> `window.atm.*hotkey/profile/history methods*` -> `electron/preload.ts` -> `electron/ipc/hotkey.ipc.ts` / `history.ipc.ts` -> `core/parser/*`, `core/validator/*`, `core/apply/*`, `core/profile/*`

`HotkeyWorkspacePage` 保持数据与选中状态所有权；`/hotkeys/keys` 和 `/hotkeys/list` 复用 `HotkeyEditorPanel` 的编辑/接管/修正逻辑，仅切换键盘或列表详情布局，`/hotkeys/conflicts` 继续使用独立诊断面板。三个子路由共享一级错误边界，不触发父工作区重载。

命令辅助链由 `HotkeyCommandAssist` 调用 renderer-safe 的 `hotkeyCommandSuggestions.ts`，读取构建时命令词典并合并当前工作区命令，不经过 IPC。提交后的真实编辑链仍使用 `hotkey:generate-add-plan` / `hotkey:generate-edit-plan` / `hotkey:execute-edit-plan`；env 与 Profile 写入都由 `core/apply/hotkeyEditPlan.ts` 校验目标、备份、执行和回滚。

### Shared Workspace UI

`src/main.tsx` -> `src/App.tsx` (`Layout` + `Suspense` + `RouteErrorBoundary`) -> `src/config/routePageLoaders.ts` -> route-specific page chunk -> `src/shared/ui/{workspace,feedback,overlays}`. `Layout` preloads the same route loader on link hover/focus. `ApplyPlanDialog` is shared by Hotkey, Skill and Menu while plan generation/execution remains feature-owned.

对话框链：业务组件 -> `src/shared/ui/overlays/BusinessDialog.tsx` -> `useDialogFocus.ts` -> 初始焦点 / Tab 循环 / Escape -> 关闭后恢复触发控件。Apply Plan 与业务弹窗执行中均可通过 `dismissDisabled` 禁止退出；业务回调和 IPC 仍归各功能页面所有。

用户错误链：页面捕获异常 -> `src/shared/ui/feedback/formatUserError.ts` -> 中文可恢复提示。该层只处理展示文案，不吞掉日志，也不改变 IPC 响应协议。

快捷键键盘由 `src/components/KeyboardVisualizer.tsx` 以固定字号渲染；空间不足时只滚动 `.keyboard-visualizer-wrapper`，不再经过独立的 viewport 缩放模块。

### Skill Management

`src/pages/SkillPage.tsx` -> `SkillWorkspaceTable` / `SkillDetailSidebar` -> `window.atm.*skill methods*` -> `electron/preload.ts` -> `electron/ipc/skill.*.ipc.ts` -> `core/skill/*`, `core/generator/generateSkillLoader.ts`, `core/validator/*`

Renderer responsibility: `SkillPage` owns orchestration and Apply Plan state; table/detail components render data and emit user intent without direct filesystem or IPC access.

Skill profile apply chain: `SkillPage` -> `skillProfileCreateApplyPlan/skillProfileExecuteApplyPlan` -> `electron/ipc/skill.profile.ipc.ts` -> unified `core/apply/applyPlanEngine.ts` -> backups/history/filesystem -> rescan.

### Menu Management

`src/pages/MenuPage.tsx` -> `window.atm.*menu methods*` -> `electron/preload.ts` -> `electron/ipc/menu.ipc.ts` -> `core/menu/*`, `core/apply/*`

菜单恢复链：`menu:load-profiles` -> `findMenuProfileRecovery()` 只读扫描当前环境的 ATM 备份 -> `menu:create-recovery-plan` -> 可信一次性 Apply Plan -> 仅恢复 `menu_profile.json`。恢复后必须再次审阅普通菜单 Apply Plan，才会按目标版本重建 `generated_menu.il`（17.2=GBK，17.4=UTF-8）。

Allegro 文本编码链：`locateEnvironment().allegroVersion` -> `getAllegroTextEncoding()` -> Menu/Skill/Bridge 计划的 `.il` / `allegro.ilinit` 步骤携带 `textEncoding` -> `applyPlanEngine` 按版本写入。读取旧脚本使用 `readAllegroTextFile()` 自动识别 UTF-8/GBK；JSON 和历史文件不参与转码。

多环境提示链：菜单页加载当前环境为空时，IPC 只读检查注册表中的其他 `pcbenv/atm_generated`，返回存在源方案、恢复备份或旧 IL 的环境；不会自动跨环境复制，用户可选择切换查看或审阅显式复制计划。

跨环境菜单复制链：`MenuPage` 蓝色环境提示 -> `menuCreateEnvironmentCopyPlan` -> `menu:create-environment-copy-plan` -> `copyMenuProfileStoreFromEnvironment()` -> 可信一次性 Apply Plan -> 目标环境 `menu_profile.json`。只复制非空源方案为独立草稿，不写来源环境，也不直接生成 `generated_menu.il`。

切换保护链：`MenuPage` 注册 `environmentSwitchGuard` -> 侧栏或页面内环境切换先等待 `menu:save-draft` -> 成功后 `env:set-active-workspace` -> 页面刷新；方案 CRUD/切换后统一重建 `store/profile/items/savedItemsJson` 状态，避免编辑对象与下拉选项漂移。

菜单树排序链：src/components/MenuTree.tsx -> src/pages/MenuPage.tsx -> src/utils/menuTreeOrder.ts -> 现有 Menu Apply Plan。拖动仅改变同级 order，不直接触发 IPC 写入。


### Application Update

src/components/common/ApplicationUpdatePanel.tsx -> electron/preload.ts -> electron/ipc/update.ipc.ts -> electron/services/updateService.ts -> electron-updater -> HTTPS generic feed。更新仅在正式 NSIS 安装版启用，下载和安装由用户显式触发。

### Color Scheme（配色方案）

`src/pages/ColorPage.tsx` -> `ColorPaletteGrid` / `ColorLayerList` -> `window.atm.color*` -> `electron/preload.ts` -> `electron/ipc/color.ipc.ts` -> `core/color/*` -> `%APPDATA%/AllegroToolkitManager/color_schemes.json`（跨板子全局）

- 捕获链：Vibe Bridge（`vibe_in.il` / `vibe_out.log`）执行 `axlColorGet` + `axlVisibleGet` + `axlIsVisibleLayer`，经 `parseSkillLisp` 解析为快照。
- 应用链：`color:apply-preview` 查询目标板叠层并生成最终颜色映射预览 -> `ColorApplyPreviewDialog` 确认 -> `color:apply` 按角色映射（顶层/底层/平面层/内部信号层）生成 SKILL 写入，应用前自动保存当前板子快照（`core/color/colorUndo.ts`），应用后可 `color:undo-apply` 一键撤销。
- 单层自定义颜色：`ColorLayerList` 行内 Hex 编辑器 -> `createCustomLayerColorPlan`（复用匹配颜色 / 独立索引 / 空闲索引，绝不连带改其他图层）-> `colorUpdateScheme` 合并写回，且保留图层可见性、层类型等元数据。
- 调色板与图层结构：`core/color/colorPalette.ts`（24 色默认 / .col 解析生成）、`core/color/colorSchemeManager.ts`（方案 CRUD 持久化）。

### Settings Backup & Restore（备份与恢复）

`src/pages/BackupPage.tsx` -> `window.atm.*backup methods*` -> `electron/preload.ts` -> `electron/ipc/backup.ipc.ts` -> `core/backup/backupManager.ts` -> 单文件 `.atmbak`（JSON）

- 收集链：pcbenv 级（快捷键/Skill/菜单方案、收藏、命令来源修正、Skill 元数据、已应用状态、多 env 来源设置）+ 应用级（配色方案、窗口状态）+ 界面偏好（localStorage `atm_` 前缀）。
- 恢复链：选择文件 -> `backup:inspect` 摘要预览 -> 勾选分区 -> `backup:restore` 前自动备份现有配置到 `atm_generated/backups/pre-restore-<时间戳>/`，原子写入并记录 change_history。
- 窗口状态：`electron/windowState.ts` + `core/settings/windowState.ts` 持久化大小/位置/最大化；恢复时校验显示器可见区域，外接屏拔掉不会恢复到屏幕外。

### IPC Runtime Diagnostics（通道注册表）

`electron/ipc/channelRegistry.ts` 在 `registerIpcHandlers` 入口包装 `ipcMain.handle`，把实际注册通道记入 `registeredChannels`；`app:getRuntimeInfo` 用该集合替代 `ipcMain.listenerCount()`（后者对 handle 注册恒为 0），从而让版本自检准确报告缺失 handler。

### Workspace Unified Profile（统一工作区方案）

`core/workspace/workspaceManager.ts`（CRUD）-> `core/workspace/buildWorkspacePreview.ts`（统一预览）-> `core/workspace/planWorkspaceApply.ts`（应用顺序与环境锁规划）-> `electron/ipc/workspace.ipc.ts` -> `%APPDATA%/AllegroToolkitManager/workspaces.json`

- 数据模型：`WorkspaceProfile` 绑定 environmentId + hotkey/skill/menu/color 四类子方案；存储于应用级配置目录，随设置备份迁移（默认工作区不迁移）。
- 预览链：`workspace:preview` 从各模块加载摘要，环境优先按工作区绑定、回退当前激活。
- 应用规划：`planWorkspaceApplySequence` 按 Skill → 菜单 → 快捷键 → 配色 顺序编排；环境锁不一致或无可应用方案时拒绝执行。
- 执行链：`workspace:apply-plan` 校验环境锁与模块可用性并返回执行序列；页面按序列串联各模块既有 Apply Plan API（skill-profile / menu / hotkey / color），不绕过既有写入链路。
- 页面：`UnifiedWorkspacePage`（`/workspace`）承载工作区 CRUD、统一预览、应用选项与执行结果汇总；侧栏「工作区」为主分组首位。
- 绑定链：配置弹窗 -> `workspace:binding-options` -> 目标环境方案候选 -> `workspace:update` -> `updateWorkspace` -> `workspaces.json` 原子替换 -> 页面刷新。
- 确认对象：页面保存用户点击的 `applyTarget`，预览、确认标题和四类子方案执行始终引用同一个工作区，不使用可能不同的 activeWorkspace。
- 可信计划：Menu / Skill Profile / Vibe Bridge 计划在 `electron/ipc/trustedApplyPlan.ts` 注册为一次性主进程快照；执行 IPC 拒绝内容篡改、跨作用域复用、过期和重复执行。
