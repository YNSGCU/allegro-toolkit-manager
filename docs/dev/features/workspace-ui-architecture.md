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
- `foundations/dialogs.css`：统一 Apply Plan 对话框。

公共组件：

- `WorkspacePage`：页面尺寸、密度和滚动策略。
- `WorkspaceHeader`：eyebrow、标题、说明与主要操作。
- `StatusStrip`：业务状态的紧凑、可读摘要。
- `PageState`：加载、空数据和错误状态。
- `ApplyPlanDialog`：Hotkey、Skill、Menu 共用的写入确认界面。

## 页面契约

每个路由页遵循以下顺序：

1. `WorkspaceHeader`
2. 方案栏（适用时）
3. `StatusStrip` 或 `GlobalStatusBar`
4. 主操作 / 更多操作 / 搜索筛选
5. 主工作区
6. `ApplyPlanDialog` 与结果反馈

快捷键页使用固定密度和紧凑页签，不再按窗口尺寸缩放整页。菜单页使用受控高度的树/属性分栏。概览和环境页显示真实运行数据，不再渲染重复的营销式入口卡片。

## 写入安全边界

UI 重置不授权任何直接写文件行为。Hotkey、Skill 和 Menu 的写入仍必须先生成 Apply Plan，由用户确认后经 Electron IPC 进入统一执行引擎；备份、回滚清单和变更历史规则保持不变。

## 快捷键数据装载

`src/services/loadHotkeyWorkspaceData.ts` 负责环境、方案、保留键、参考 env、收藏与撤销状态的读取和归一化。页面只消费装载结果，旧的 2000 行快捷键页面已经删除。

## 验证要求

- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
- `npm test`
- `npm run build:renderer`
- 1220×820、1360×920、1600×1000 三档浏览器检查，无横向溢出

生产构建当前仍会提示主 JS chunk 大于 500kB；这不阻断本次 UI 重置，后续可通过路由级动态导入处理。
