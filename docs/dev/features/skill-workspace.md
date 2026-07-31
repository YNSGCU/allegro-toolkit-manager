# Feature: Skill 管理工作台

## 目的

以高密度列表和分区详情检查器承载 Skill 扫描、检索、诊断、方案预览与 Apply Plan 操作，同时保持现有 IPC/core 安全边界不变。

## 所属模块

- 模块：`src/pages`、`src/components`
- 公共入口：`src/pages/SkillPage.tsx`
- 展示组件：`src/components/SkillWorkspaceTable.tsx`、`src/components/SkillDetailSidebar.tsx`
- 相关文档：`docs/MODULE_MAP.md`、`docs/user/features/skill-workspace.md`

## 功能链

```txt
SkillPage -> window.atm.*skill* -> electron/preload.ts -> electron/ipc/skill.*.ipc.ts
  -> core/skill + core/validator + core/generator -> UI refresh/error/empty state
```

启停与方案应用仍经过：

```txt
UI action -> create SkillApplyPlan -> page pendingPlan -> user confirmation
  -> applySkillChanges -> backup/write/history -> rescan UI
```

## 入口

- UI：`SkillPage` 的“Skill 管理 / 命令 / 诊断”视图
- IPC：既有 `skill:*` 通道，以及 `skill-profile:create-apply-plan`、`skill-profile:execute-apply-plan`
- 核心：`core/skill/*`、`core/validator/*`、`core/generator/generateSkillLoader.ts`
- 存储：既有 Skill profile、loader、ATM managed 文件

## 公共接口

新增 `skillProfileExecuteApplyPlan(planJson)` 以闭合 Skill 方案执行链；处理器拒绝非 Skill 模块的计划，并调用统一 Apply Plan 引擎。`SkillWorkspaceTable` 接收已筛选的 `SkillFileItem[]`，只发出选择和启停意图，不直接访问 `window.atm`。

## 数据模型

沿用 `SkillFileItem`、`SkillMeta`、`SkillUsageInfo`、`SkillReferenceIssue` 和 `SkillApplyPlan`。引用检查增加 UI 层的 `refsChecked` 状态，用于区分“尚未检查”和“检查通过”。

`ScannedSkill.sourceFiles` 和 `SkillFileItem.sourceFiles` 用于表达目录型 Skill；`packageType: directory_package` 表示该行由多个 `.il/.ile/.cls` 文件聚合而成。入口选择顺序是 package.json 显式入口、`loader.*`、`main.*`、同目录名文件、字典序首文件。

加载源解析会递归跟踪静态 `load(...)` 和 `load(strcat(...))` 链，并识别 `.il/.ile/.cls` 及带额外参数的 `load` 形式。递归有去重与 32 层深度上限；动态计算且无法静态解析的路径仍需运行态验证。

## 布局约束

- `workspace-page-skills` 和 `skill-page-main` 必须保持 `height: 100%` 与 `min-height: 0`，否则子级表格不会获得可滚动的剩余高度。
- `skill-list-area` 是列表视图的弹性容器，`skill-workspace-table-wrap` 是唯一的主滚动容器。
- 详情分栏使用内容区栅格，不得使用穿透主容器 padding 的负 margin。主窗口小于 `1180px` 时使用详情弹窗。
- 详情标题只显示 Skill 名称，不使用表情符号或机器人头像作为来源标识。

## 错误处理

- env 缺失、解析失败或引用检查失败时保留“尚未检查”状态并展示错误。
- Skill 方案 Apply Plan 生成失败时写入页面错误结果；成功时写入 `pendingPlan`。
- 普通浏览器运行只用于静态视觉检查，完整数据链必须在 Electron 中验证。

## 测试与验证

- 自动化：`tests/skillWorkspaceTable.test.tsx`
- 核心生成：`tests/skillProfileManager.test.ts`
- 构建：`npm run build:renderer`
- 手工：Electron 中扫描真实 Skill，打开四个详情分类并生成/取消 Apply Plan

## 已知注意事项

- 参见 `.structure-os/PITFALLS.md` 中 Skill 诊断状态条目。
- 页面仍是现有 `pages/components/hooks` 结构，本次没有执行全项目目录迁移。

## 扩展说明

- 数据请求留在页面容器或专用 Hook，表格和详情组件保持展示职责。
- 新增写入行为时必须接入 Apply Plan，不得从表格行按钮直接写文件。
