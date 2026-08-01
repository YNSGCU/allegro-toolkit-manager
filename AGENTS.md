# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Communication

- Default to replying to the user in Chinese unless the user explicitly asks for another language.

## Commands

```powershell
# 安装依赖（国内镜像）
npm install --registry=https://registry.npmmirror.com

# 编译 Electron 主进程（修改 electron/、core/ 后必须执行）
npm run build:electron
# 或: npx.cmd tsc -p tsconfig.electron.json

# 构建前端生产版本
npm run build:renderer
# 或: npx.cmd vite build

# 完整构建（Electron → 前端，串行）
npm run build

# 运行全部测试
npm test

# 运行单个测试文件
npx.cmd vitest run tests/parseEnv.test.ts

# 监听模式运行测试
npm run test:watch

# 仅启动 Vite 开发服务器（热更新）
npm run dev:vite

# 启动 Electron 应用
# 开发模式（先运行 npx.cmd vite，再开新终端）：
$env:VITE_DEV_SERVER_URL="http://localhost:5173/"
npx.cmd electron dist-electron/electron/main.js
# 生产模式（build 后直接启动）：
npx.cmd electron dist-electron/electron/main.js

# TS 类型检查（前端）
npx.cmd tsc --noEmit

# TS 类型检查（后端）
npx.cmd tsc -p tsconfig.electron.json --noEmit

# 预览构建产物
npm run preview

# == 注: npm run dev 是 scripts/dev-electron.mjs 别名，
#    都会启动 Electron 并等待 Vite 端口就绪。不是"仅 Electron"。 ==
```

## Architecture

### Project Status

> Git 已初始化。UI 重置基线提交为 `c95a222`；后续修改应在保留用户改动的前提下增量提交。

### Process Separation

```
React Renderer (src/) ←IPC (contextBridge)→ Electron Main (electron/) ←import→ Core Engine (core/) → File System
     │                                                                   │
  UI only (React 19, Vite 6)                                   Pure TS, testable without Electron
```

- **core/** — Pure TypeScript, depends only on Node.js built-ins (fs, path, crypto). Testable via Vitest without Electron.
- **electron/** — Main process with BrowserWindow, IPC handlers, preload script. Imports core/ modules.
- **src/** — React renderer via contextBridge (`window.atm.*`). Has no `process.env` access (contextIsolation: true).
- **src/types/** — Shared type definitions used by both main and renderer.

**Two tsconfigs**: `tsconfig.json` for frontend (src/), `tsconfig.electron.json` for backend (electron/ + core/ + src/types/).

**Path alias mismatch**: `tsconfig.json` defines `@/*` → `src/*` and `@core/*` → `core/*`. `tsconfig.electron.json` only has `@core/*`. **The Vite config only has `@` → `src/`**, so `@core/` imports work in TypeScript type-checking but **NOT** in Vite bundling — use relative paths (`../../core/`) from `src/` components to reach core/ modules.

### Renderer Route Structure

HashRouter in `src/App.tsx`:

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `Navigate` | 跳转到默认快捷键工作区 |
| `/overview` | `DashboardPage` | 系统状态 / 健康评分 |
| `/environment` | `EnvironmentPage` | 环境检测 / 多 env 来源管理 |
| `/hotkeys/*` | `HotkeyWorkspacePage` | 快捷键工作区（键位 / 冲突，工具弹窗承载导入导出） |
| `/skills` | `SkillPage` | Skill 管理（表格 + 三类详情 + 方案栏） |
| `/menu` | `MenuPage` | 菜单树编辑 + 方案栏 |

Layout at `src/components/Layout.tsx` — sidebar with NavLink items. `Layout` stays eager; the five page components are loaded with `React.lazy()` under one `Suspense` boundary so Vite emits route-level chunks. Keep Vite `base: './'` aligned with Electron's embedded production asset server.

### IPC Pattern (6-Layer)

```
6. React call:      window.atm.methodName()
5. Declare type:    src/types/window.d.ts → interface Window.atm { ... }
4. Expose via:      electron/preload.ts → ipcRenderer.invoke('ns:action', ...)
3. Register in:     electron/ipc/index.ts → registerXxxIpc()
2. Handler:         electron/ipc/xxx.ipc.ts → ipcMain.handle('ns:action', handler)
1. Logic:           core/xxx.ts → pure TS, testable
```

Response format: `{ success: true, data: ... }` or `{ success: false, error: "..." }`

**IPC modules** (18+ handler files):

| IPC Module | Files | Channels (examples) |
|-----------|-------|-------------------|
| Hotkey | `hotkey.ipc.ts` | `hotkey:parse-env`, `hotkey:validate`, `hotkey:create-apply-plan` |
| Profile | `hotkey.ipc.ts` | `profile:list/create/copy/rename/delete/export/import/set-applied/get-applied` |
| Skill Scan | `skill.scan.ipc.ts` | `skill:scan`, `skill:enhanced-scan`, `skill:check-load` |
| Skill Apply | `skill.apply.ipc.ts` | `skill:toggle`, `skill:create-delete-plan`, `skill:export-package` |
| Skill Refs | `skill.refs.ipc.ts` | `skill:validate-refs`, `skill:enhanced-refs`, `skill:check-stale-refs` |
| Skill Usage | `skill.usage.ipc.ts` | `skill:usage-statuses`, `skill:health-scores`, `skill:usage-tree` |
| Skill Meta | `skillMeta.ipc.ts` | `skillMeta:getAll/get/save/analyze/analyzeAll/clearAuto` |
| **Skill Profile** | `skill.profile.ipc.ts` | `skill-profile:load-all/create/copy/rename/delete/set-active/build-snapshot/compute-diff/create-apply-plan` |
| Menu | `menu.ipc.ts` | `menu:load-profiles/save-draft/validate/generate-preview/create-apply-plan/check-status` + `menu:profile-*` |
| Env | `env.ipc.ts` | `env:locate`, `env:scan-all`, `env:read-raw-line` |
| Import | `import.ipc.ts` | `import:open-dialog/parse-file/compute-conflicts/execute` |
| History | `history.ipc.ts` | `history:load/undo/add/clear` |
| App | `app.ipc.ts` | `app:getRuntimeInfo` |

### Data Flow

```
core/ filesystem operations → IPC handler → preload.ts contextBridge
  → React component calls window.atm.xxx()
  → Returns { success, data } or { success, error }
  → State management: useState + useCallback per page, no global store
  → Data re-fetched on mount and after mutations (never cross-page shared state)
```

### Component Tree

```
App → Layout (sidebar NavLink)
  ├── DashboardPage
  ├── EnvironmentPage
  ├── HotkeyWorkspacePage
  │     ├── ProfileBar (V5.6: unified profile bar with applied state)
  │     ├── GlobalStatusBar (V5.6: status pills)
  │     ├── EnvSourceBar
  │     ├── MoreActionsMenu (V5.6: secondary actions dropdown)
  │     ├── KeyboardVisualizer (Layer 1: keyboard occupancy)
  │     ├── HotkeyMap (Layer 2: grouped cards)
  │     ├── HotkeyList (Layer 3: detail table)
  │     ├── EnhancedConflictList (10 conflict types)
  │     ├── HotkeyEditor (edit with diff + conflict detection)
  │     ├── PhysicalKeyBindingPanel
  │     └── ... (ImportPreview, EnvImport, ChangeHistory, ExportCheatsheet)
  ├── SkillPage
  │     ├── ProfileBar (V5.6: unified profile bar)
  │     ├── GlobalStatusBar (V5.6: status pills)
  │     ├── MoreActionsMenu (V5.6: secondary actions dropdown)
  │     ├── SkillCard / SkillDetailSidebar
  │     ├── CommandRegistryTable
  │     ├── EnhancedRefCheck
  │     ├── SkillMetaDialog / SkillDeleteImpactDialog
  │     └── CompanySkillManager
  └── MenuPage (V5.6)
        ├── ProfileBar (V5.6: unified profile bar)
        ├── GlobalStatusBar (V5.6: status pills for draft/il/bootstrap)
        ├── MoreActionsMenu (V5.6: new/scan actions)
        ├── MenuTree (递归树 + 问题指示器)
        ├── MenuItemEditor (详情 + 命令状态)
        ├── CommandSelector (命令选择弹窗)
        ├── MenuPreviewDialog (可视化/IL/JSON 三Tab)
        └── MenuApplyPlanDialog (+ impact summary)
```

## Documentation

All in Chinese in `docs/`:
| File | Content |
|------|---------|
| `开发手册.md` | Architecture, module details, contribution guide — updated for V5.6 |
| `用户手册.md` | Installation, features, configuration — updated for V5.6 |
| `避坑指南.md` | Gotchas, Windows pitfalls |

## Key Design Rules

### All Writes Must Go Through Apply Plan

| Module | Operations |
|--------|-----------|
| Hotkey | edit, add, delete, comment, import, apply profile, batch replace |
| Skill | enable/disable, add/remove loader, delete, generate loader, modify ilinit |
| Menu | add/delete/edit menu items, reorder, generate menu.il, update profile |
| Sync/Backup | restore, overwrite, apply imported profile |

### Security Boundaries

1. No direct overwrites of user env / Skill files / install-dir env / company dir
2. SHA256 backup before every write; rollback manifest on failure
3. Every Apply Plan execution records to change_history.json (last 100, supports undo)
4. No silent failures — every operation produces Toast/error in Chinese
5. Menu: only ATM managed overlay (generated_menu.il), never modify original .men files
6. Profiles: delete protection (default profile / active-in-use profile cannot be deleted)

### Profile Architecture (V5.6)

```
Workspace Profile (预留)
├── hotkeyProfileId → Hotkey Profile (快捷键方案, 已有)
├── skillProfileId  → Skill Profile (Skill 方案, V5.5 新增)
└── menuProfileId   → Menu Profile (菜单方案, V5.5 增强)
```

- **统一 ProfileBar**: 三页共用同一 `ProfileBar` 组件（快捷键/Skill/菜单）；旧 `ProfileSelector` 已删除
- **切换预览**: 切换方案只预览，不写文件
- **应用确认**: 必须点击"应用此方案"生成 Apply Plan 确认后才写入
- **已应用状态**: ProfileBar 右侧显示 ✅ 已应用 / ⚠ 尚未应用 状态
- **删除保护**: 默认方案不可删；使用的方案不可删；删除只删 ATM 配置不影响 env/menu
- **已应用追踪**: `appliedProfileId` 持久化到 `settings/applied_profile.json`

### V5.6 UI 统一规则

三大核心页面（快捷键/Skill/菜单）顶部结构统一为：

```
页面标题
ProfileBar（方案栏）
GlobalStatusBar（胶囊状态条）
主操作按钮 + MoreActionsMenu（更多操作下拉） + 搜索/筛选
```

- 主操作（1-2 个）：保留为蓝色/绿色突出按钮
- 普通操作：收进"更多操作"下拉（MoreActionsMenu）
- 删除类操作：下拉中红色标记（.danger）
- GlobalStatusBar 状态颜色：绿色=正常，黄色=警告，红色=错误，灰色=未涉及

### Menu Tree Validation (10 rules in `src/types/menu.ts`)

| # | Rule | Severity |
|---|------|----------|
| 1 | Top-level cannot be separator | error |
| 2 | Top-level cannot be command | error |
| 3 | Separator cannot have children | error |
| 4 | Command cannot have children | error |
| 5 | Command must have command field | warning |
| 6-7 | Menu/command label must not be empty | error |
| 8 | Same-level labels should not duplicate | warning |
| 9-10 | ID / parentId must be valid | error |
| 11 | No circular references in parent chain | error |

Errors block Apply Plan generation and IL generation.

## Module Map

### core/ (Pure TS, testable)

| Module | Key Files | Purpose |
|--------|-----------|---------|
| `core/environment/` | `locateEnvironment.ts`, `scanEnvSources.ts`, `fileAccess.ts`, `envRawLineReader.ts` | Path detection, multi-env scanning, file I/O |
| `core/parser/` | `parseEnv.ts`, `parseFunckey.ts`, `parseAlias.ts`, `parseSkillMeta.ts` | Env/Skill file parsers |
| `core/skill/` | `scanSkill.ts`, `commandIndex.ts`, `enhancedScan.ts`, `skillMeta.ts`, `skillImpactAnalysis.ts`, `skillUsageStatus.ts`, `skillProfileManager.ts` | Skill scanning, command registry, metadata, profiles |
| `core/menu/` | `menuManager.ts`, `menuValidator.ts` | Menu CRUD, tree operations, IL generation, validation, profile management, recommendation engine |
| `core/validator/` | `validateHotkeys.ts`, `validateSkillRefs.ts`, `commandClassifier.ts`, `skillLoadChecker.ts`, `enhancedConflictDetector.ts` | Conflict detection, ref validation |
| `core/generator/` | `generateManagedEnvBlock.ts`, `generateBootstrap.ts`, `generateSkillLoader.ts` | ATM managed block, bootstrap, loader generation |
| `core/apply/` | `applyPlanEngine.ts`, `createApplyPlan.ts`, `applyChanges.ts`, `hotkeyEditPlan.ts` | Unified Apply Plan engine |
| `core/profile/` | `hotkeyProfile.ts` | Hotkey profile CRUD |
| `core/backup/` | `createBackup.ts`, `rollbackManifest.ts` | SHA256 backup |
| `core/changeHistory/` | `changeHistory.ts` | Undo system |
| `core/dictionary/` | `command_dictionary.json`, `availableKeyRecommender.ts`, `hotkeyExportService.ts`, `hotkeyFavorites.ts` | Command names, key recommendation, export |
| `core/settings/` | `atmSettings.ts` | Settings persistence |

### electron/ipc/ (18 handler files)

`app.ipc.ts`, `env.ipc.ts`, `hotkey.ipc.ts`, `menu.ipc.ts`, `skill.scan.ipc.ts`, `skill.apply.ipc.ts`, `skill.refs.ipc.ts`, `skill.usage.ipc.ts`, `skillMeta.ipc.ts`, `skill.profile.ipc.ts`, `history.ipc.ts`, `import.ipc.ts`, `index.ts`

### src/types/ (Shared)

`menu.ts` (V5.5), `skill.ts`, `skillProfile.ts` (V5.5), `workspaceProfile.ts` (V5.5), `applyPlan.ts`, `hotkey.ts`, `environment.ts`, `importEnv.ts`, `runtime.ts`, `window.d.ts`

### src/components/

Key components: `ProfileBar.tsx` (V5.6 unified profile bar — merged ProfileSelector), `GlobalStatusBar.tsx` (V5.6 status pills), `MoreActionsMenu.tsx` (V5.6 secondary actions dropdown), `MenuTree.tsx`, `MenuItemEditor.tsx`, `CommandSelector.tsx`, `MenuPreviewDialog.tsx`, `MenuApplyPlanDialog.tsx`, `SourceBadge.tsx`, `Toast.tsx`, `ConfirmDialog.tsx`, `ErrorPanel.tsx`

## Testing

- **216 tests** across 40 test files — Vitest 3.2
- Pure `core/` code and renderer contracts/components are testable with Vitest; Electron runtime behavior still needs type/build or desktop validation
- Test fixtures in `test-fixtures/` directory
- Single file: `npx.cmd vitest run tests/parseEnv.test.ts`

## Windows-Specific Notes

- All `npx` commands need `.cmd` suffix in PowerShell: `npx.cmd vite`
- Electron GUI cannot be started from non-interactive sessions
- Env vars: PowerShell `$env:VAR`, CMD `set VAR=`
- Chinese paths, spaces, non-ASCII characters fully supported (UTF-8 everywhere)
