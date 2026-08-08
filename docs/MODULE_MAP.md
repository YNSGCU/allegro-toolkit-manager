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

多版本链：`Layout/EnvironmentPage` -> `listAllegroEnvironments/setActiveAllegroEnvironment` -> `env:list-workspaces/env:set-active-workspace` -> `core/environment/environmentRegistry.ts` -> `%APPDATA%/AllegroToolkitManager/environments.json`。`locateEnvironment()` 统一解析活动环境，快捷键、Skill、菜单 Apply Plan 生成时锁定 `environmentId + pcbenvPath`，执行前拒绝环境漂移。

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


菜单树排序链：src/components/MenuTree.tsx -> src/pages/MenuPage.tsx -> src/utils/menuTreeOrder.ts -> 现有 Menu Apply Plan。拖动仅改变同级 order，不直接触发 IPC 写入。


### Application Update

src/components/common/ApplicationUpdatePanel.tsx -> electron/preload.ts -> electron/ipc/update.ipc.ts -> electron/services/updateService.ts -> electron-updater -> HTTPS generic feed。更新仅在正式 NSIS 安装版启用，下载和安装由用户显式触发。

### Color Scheme（配色方案）

`src/pages/ColorPage.tsx` -> `ColorPaletteGrid` / `ColorLayerList` -> `window.atm.color*` -> `electron/preload.ts` -> `electron/ipc/color.ipc.ts` -> `core/color/*` -> `%APPDATA%/AllegroToolkitManager/color_schemes.json`（跨板子全局）

- 捕获链：Vibe Bridge（`vibe_in.il` / `vibe_out.log`）执行 `axlColorGet` + `axlVisibleGet` + `axlIsVisibleLayer`，经 `parseSkillLisp` 解析为快照。
- 应用链：`color:apply` -> `core/color/vibeColorBridge.ts` 按角色映射（顶层/底层/平面层/内部信号层）生成 SKILL，写入前经 UI 确认。
- 单层自定义颜色：`ColorLayerList` 行内 Hex 编辑器 -> `createCustomLayerColorPlan`（复用匹配颜色 / 独立索引 / 空闲索引，绝不连带改其他图层）-> `colorUpdateScheme` 合并写回，且保留图层可见性、层类型等元数据。
- 调色板与图层结构：`core/color/colorPalette.ts`（24 色默认 / .col 解析生成）、`core/color/colorSchemeManager.ts`（方案 CRUD 持久化）。

### Settings Backup & Restore（备份与恢复）

`src/pages/BackupPage.tsx` -> `window.atm.*backup methods*` -> `electron/preload.ts` -> `electron/ipc/backup.ipc.ts` -> `core/backup/backupManager.ts` -> 单文件 `.atmbak`（JSON）

- 收集链：pcbenv 级（快捷键/Skill/菜单方案、收藏、命令来源修正、Skill 元数据、已应用状态、多 env 来源设置）+ 应用级（配色方案、窗口状态）+ 界面偏好（localStorage `atm_` 前缀）。
- 恢复链：选择文件 -> `backup:inspect` 摘要预览 -> 勾选分区 -> `backup:restore` 前自动备份现有配置到 `atm_generated/backups/pre-restore-<时间戳>/`，原子写入并记录 change_history。
- 窗口状态：`electron/windowState.ts` + `core/settings/windowState.ts` 持久化大小/位置/最大化；恢复时校验显示器可见区域，外接屏拔掉不会恢复到屏幕外。

### IPC Runtime Diagnostics（通道注册表）

`electron/ipc/channelRegistry.ts` 在 `registerIpcHandlers` 入口包装 `ipcMain.handle`，把实际注册通道记入 `registeredChannels`；`app:getRuntimeInfo` 用该集合替代 `ipcMain.listenerCount()`（后者对 handle 注册恒为 0），从而让版本自检准确报告缺失 handler。
