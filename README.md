# Allegro Toolkit Manager (ATM)

个人 Allegro 工作环境配置管理工具，提供快捷键管理、Skill 管理、环境检测等功能。

## 开发说明

### 技术栈

- **前端**: React 19 + TypeScript + Vite 6
- **后端**: Electron 35 + Node.js (TypeScript)
- **测试**: Vitest 3

### 目录结构

```
├── core/           # 核心逻辑（纯 TS，可独立测试）
├── electron/       # Electron 主进程 + IPC + Preload
│   └── ipc/        # IPC 处理器（已按功能拆分子模块）
├── src/            # React 渲染进程
│   ├── components/ # UI 组件
│   │   └── common/ # 通用组件（Toast、ConfirmDialog、ErrorPanel）
│   ├── hooks/      # React Hooks（数据加载、筛选、元数据、Apply Plan）
│   ├── pages/      # 页面（Dashboard、Environment、Hotkey、Skill）
│   └── types/      # TypeScript 类型定义
├── docs/           # 中文文档
└── scripts/        # 开发辅助脚本
```

### 开发流程

推荐开发流程：

```bash
# 1. 安装依赖（国内用户使用镜像）
npm install --registry=https://registry.npmmirror.com

# 2. 启动 Vite 开发服务器（新终端）
npm run dev:vite
# 或: npx.cmd vite

# 3. 编译 Electron 主进程 + 启动 Electron（另一个新终端）
npm run dev
```

> **重要**: `npm run dev` 会启动 Electron 并等待 Vite 端口就绪。
> 但它**不会自动重新编译 TypeScript**。修改 Electron main/preload 后需要手动重建。

### 修改后必须重建的场景

| 修改内容 | 必须执行 |
|---------|---------|
| 修改 `electron/`（main.ts、preload.ts、IPC 文件） | `npm run build:electron` → 重启 Electron |
| 修改 `core/` 核心模块 | `npm run build:electron` → 重启 Electron |
| 修改 `src/` 渲染进程 | 刷新页面即可（Vite 热更新） |
| 新增 IPC handler | `npm run build:electron` → 重启 Electron |
| 新增 Preload API | `npm run build:electron` → 重启 Electron |

### 构建命令

```bash
# 完整构建（Electron → 前端，串行）
npm run build

# 单独构建 Electron 主进程
npm run build:electron

# 单独构建前端
npm run build:renderer

# 预览构建产物
npm run preview
```

### 常见问题

**问题**: 运行时报错 `Error: No handler registered for 'skillMeta:save'`

**原因**: 当前运行的 Electron 主进程是旧版本，没有包含最新的 IPC handler。

**解决**:
1. 执行 `npm run build:electron` 重新编译主进程
2. 重启 Electron 应用
3. 如果问题依旧，执行完整构建 `npm run build`

**问题**: 开发时修改了 electron/ 但页面没有变化

**原因**: Electron 主进程不会自动热更新，需要手动重建重启。

**问题**: 前端页面和 Electron 主进程版本不一致

**解决**: 在概览页面底部查看「运行版本信息」面板，确认 main/preload/renderer 版本一致。

### 调试日志

默认关闭调试日志。开启方式：

```bash
# Windows PowerShell
$env:ATM_DEBUG="true"
npm run dev

# 或临时启用
$env:ATM_DEBUG_SKILL="true"
npm run dev
```

开启后输出详细的 Skill 扫描、命令索引、引用匹配日志。
错误日志不受此开关控制，始终输出。

### 运行版本自检（V5.4）

系统启动时自动进行三层版本一致性检查：

1. **Main 进程** — `app:getRuntimeInfo` handler
2. **Preload** — `window.atm.getRuntimeInfo()` API
3. **Renderer** — 启动时调用并输出版本信息

概览页底部显示版本面板：
- 应用版本、Node.js 版本、Electron 版本
- Main 启动时间、Preload API 版本
- 所有已注册 IPC handler 的状态
- Handler 缺失时显示明确的中文提示和重建建议

### 测试

```bash
# 运行全部测试
npm test

# 运行单个测试文件
npx.cmd vitest run tests/parseEnv.test.ts

# 监听模式
npm run test:watch
```

测试仅覆盖 `core/` 目录（纯 TypeScript 模块）。
`electron/` 代码需要 Electron 运行时，无法通过 Vitest 测试。

### 项目状态

- ⚠️ 当前不是 git 仓库，使用 `git init` 初始化
- 无 ESLint/Prettier 配置
- 无 CI/CD 配置
- TypeScript 类型检查是唯一的静态分析工具

## 模块地图

| 模块 | 说明 |
|------|------|
| `core/environment/` | HOME/pcbenv 检测、文件访问、环境扫描 |
| `core/skill/` | Skill 扫描、命令索引、元数据、使用状态 |
| `core/parser/` | env 快捷键解析、Skill 函数解析 |
| `core/validator/` | 冲突检测、引用校验、命令分类 |
| `core/generator/` | 生成 Managed Block、bootstrap、loader |
| `core/apply/` | Apply Plan 创建与执行 |
| `core/backup/` | SHA256 备份、回滚清单 |
| `electron/ipc/` | IPC 处理器（已按功能拆分为子模块） |

更多文档参见 `docs/` 目录（中文）。
