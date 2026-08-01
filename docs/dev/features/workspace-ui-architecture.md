# 统一工作区 UI 架构

## 目标

渲染进程采用“稳定应用壳层 + 页面工作区契约 + 业务组件”的三层结构。重置只调整信息架构和交互呈现，不改变 IPC、Apply Plan、备份、历史记录或文件写入边界。

## 公共层

入口为 `src/shared/ui/index.ts`，全局样式由 `src/shared/ui/styles.css` 汇总：

- `foundations/tokens.css`：颜色、字号、间距、圆角、层级和旧变量兼容映射。
- `foundations/base.css`：全局排版、焦点和可访问性基础。
- `foundations/shell.css`：216px 侧栏、主内容区和导航状态。
- `foundations/controls.css`：按钮、输入框、方案栏和表格基线。
- `foundations/workspace.css`：页头、状态条、页面状态和各工作区布局。
- `foundations/dialogs.css`：统一 Apply Plan、确认框、Toast 和菜单预览对话框。

公共组件：

- `WorkspacePage`：页面尺寸、密度和滚动策略。
- `WorkspaceHeader`：eyebrow、标题、说明与主要操作。
- `StatusStrip`：业务状态的紧凑、可读摘要。
- `PageState`：加载、空数据和错误状态。
- `ApplyPlanDialog`：Hotkey、Skill、Menu 共用的写入确认界面。
- `BusinessDialog`：深层业务弹窗共用的标题、说明、尺寸、滚动区、页脚与关闭语义。
- `RouteErrorBoundary`：异步页面加载失败时保留应用壳层，并提供重载与返回快捷键操作。
- `useDialogFocus`：共享对话框的初始焦点、Tab 循环、Escape 关闭和焦点恢复规则。

`BusinessDialog` 提供 `sm/md/lg/xl` 四档宽度及 default/warning/danger 三种风险语气。业务组件只负责表单字段、结果列表与回调，不再自行定义遮罩、标题栏、关闭按钮和焦点规则。当前已迁移新增快捷键、编辑快捷键、Skill 信息、Skill 删除影响、菜单命令选择五个高频弹窗。

## 路由加载边界

`src/App.tsx` 保持 `Layout`、导航与统一页面加载态同步可用。`src/config/routePageLoaders.ts` 统一维护五个业务页面的动态导入函数，`React.lazy()` 与侧栏预加载复用同一份映射，避免两套路径漂移。侧栏链接在鼠标悬停或键盘聚焦时预加载目标页面；实际导航仍由 `Suspense` 承接首次加载。

每个一级工作区由 `RouteErrorBoundary` 保护。页面 chunk 加载或渲染失败时，侧栏仍可使用，错误区提供“重新加载页面”和“返回快捷键”。边界 key 必须使用一级工作区根路径；`/hotkeys/keys`、`/hotkeys/list` 与 `/hotkeys/conflicts` 共用 `/hotkeys`，避免切换子页时重建 `HotkeyWorkspacePage` 并丢失已加载状态。

Electron 生产环境通过内嵌本地 HTTP 服务读取 `dist/`，并沿用 Vite 的相对资源基址 `base: './'`。入口和异步页面 chunk 都必须落在可由该服务解析的 `assets/` 路径中；修改构建基址或静态资源服务时，必须重新验证全部异步路由。禁止把构建告警通过提高 `chunkSizeWarningLimit` 隐藏。

## 页面契约

每个路由页遵循以下顺序：

1. `WorkspaceHeader`
2. 方案栏（适用时）
3. `StatusStrip` 或 `GlobalStatusBar`
4. 单一主操作 / 更多操作 / 搜索筛选
5. 主工作区
6. `ApplyPlanDialog` 与结果反馈

快捷键页使用“键位 / 列表 / 冲突”三个任务页签，不再按窗口尺寸缩放键盘或文字。键位页只承担键盘占用与物理键入口；独立列表页承担搜索、筛选、宽表格和选中详情；导入导出与历史由工具弹窗承载。页头不再显示重复的 eyebrow，方案栏与状态条在宽窗口合并到同一上下文行，窄窗口才堆叠；子页标题、说明和主操作使用单行紧凑工具栏。旧 overview 路由重定向到键位页，旧 editor 路由重定向到列表页，import-export 重定向到键位页。`.hotkey-workspace-content` 是页面纵向滚动所有者；列表页宽窗口使用双栏，窄窗口堆叠并由内部滚动容器承接内容。键盘网格和列表 Grid 子项都必须设置 `min-width: 0`，避免固有宽度撑破窄视口。

Skill 默认筛选条只保留搜索和“筛选”入口，详情固定为“概览 / 命令与引用 / 操作”三类。菜单以树编辑为唯一主工作区，命令清单与引用检查降级为工具视图；顶栏根据 dirty/unapplied/applied 状态只显示一个主操作。系统侧栏只保留“系统状态”，环境路由继续兼容。

可读性约束：

- 可见正文、辅助文案和侧栏分组标签不小于 12px。
- 页面标题统一为 26px，快捷键页内主区标题为 20px，说明文字为 14px，普通控件高度至少 34px。
- 方案栏只显示方案选择、“方案管理”和一处应用状态；内部方案 ID 仅保留在控件提示中。
- 无可用方案时选择框显示“暂无方案”，不渲染无效应用按钮。
- 键盘悬浮提示使用键盘容器的相对位置决定展开方向：上部键位向下、下部键位向上，避免遮住方案栏和工具栏。
- 数据装载状态独立于写入中的 `loading` 状态；只有成功装载后才允许显示“0 个问题”，失败时显示“加载失败 / 尚未检查”。
- Renderer 异常通过 `formatUserError()` 转为中文用户提示，不直接显示 `window.atm`、IPC 方法名或 JavaScript 异常类型。
- 页面数据错误必须紧邻错误信息提供重试操作；Dashboard、Environment、Hotkey、Skill、Menu 均不得只显示不可操作的错误文字。
- 共享对话框打开后将焦点移入对话框，Tab/Shift+Tab 不得离开，关闭后恢复到触发控件；写入执行中沿用禁止 Escape 关闭的安全规则。
- 业务表单统一使用可关联的 `label`、36px 控件高度、12–14px 信息层级、紧凑 14px 字段间距；错误使用 `role="alert"`，只读值和自动建议必须与可编辑字段视觉区分。

## 写入安全边界

UI 重置不授权任何直接写文件行为。Hotkey、Skill 和 Menu 的写入仍必须先生成 Apply Plan，由用户确认后经 Electron IPC 进入统一执行引擎；备份、回滚清单和变更历史规则保持不变。

## 快捷键数据装载

`src/services/loadHotkeyWorkspaceData.ts` 负责环境、方案、保留键、参考 env、收藏与撤销状态的读取和归一化。页面只消费装载结果，旧的 2000 行快捷键页面已经删除。

## 验证要求

- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
- `npm test`
- `npm run build:renderer`
- 1220×820、1360×920、1600×856 三档浏览器检查，无页面级横向溢出且可见文字不小于 12px

本轮生产构建入口 JS 为 246.60kB；快捷键、Skill、菜单页面包分别约为 129.80kB、84.82kB、52.77kB，原 500kB 主包告警未复发。
