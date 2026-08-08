# 统一工作区方案（Workspace Unified Profile）设计

> 状态：设计（v0.3.0 之后实施）
> 更新：2026-08-08

## 目标

把「Allegro 版本 / pcbenv + 快捷键方案 + Skill 方案 + 菜单方案 + 配色方案」绑定为一个工作区方案。用户在切换项目或 Allegro 版本时只选择一次工作区，预览后统一应用，避免在四个页面分别切换方案。

## 数据模型

扩展现有 `src/types/workspaceProfile.ts`（当前为 V5.5 预留，未被引用）：

```ts
export interface WorkspaceProfile {
  id: string;
  name: string;
  description?: string;
  /** 目标 Allegro 环境（environmentId → pcbenv / 版本） */
  environmentId?: string;
  hotkeyProfileId: string;
  skillProfileId: string;
  menuProfileId: string;
  /** 配色方案（V6.1 全局资源） */
  colorSchemeId?: string;
  createdAt: string;
  updatedAt: string;
}
```

`colorSchemeId` 为可选：配色方案是跨板子全局资源，旧工作区（无配色）仍可工作。

## 存储

- 文件：`%APPDATA%/AllegroToolkitManager/workspaces.json`（与应用级资源同目录，随备份迁移）
- 复用 `core/backup/backupManager.ts` 的应用级收集（新增 `workspaces` 分区字段）
- 删除保护：默认工作区不可删；当前使用中的工作区不可删

## 核心流程

```text
选择工作区（新页面或 ProfileBar）
  → 解析 environmentId + 四个子方案
  → 统一预览：
      环境：目标 pcbenv / Allegro 版本 / 共享影响范围
      快捷键：目标方案摘要 + 差异
      Skill：目标方案 + 加载器变化
      菜单：目标方案 + generated_menu.il 变化
      配色：目标板叠层 + 最终颜色映射（复用 ColorApplyPreview）
  → 确认后按模块生成并执行各自的 Apply Plan
      （环境锁一致：所有计划锁定同一 environmentId，环境漂移拒绝执行）
  → 全部成功后刷新各页面并记录统一历史
```

## 与现有架构的关系

- `ProfileBar` 保持每页独立方案切换（细粒度编辑入口不变）
- 统一工作区是「组合层」：只存各子方案 id，不复制子方案内容
- Apply Plan 引擎、环境锁、备份/回滚全部复用；不新增第三种写入通道
- 配色预览复用 `buildColorApplyPreview`；快捷键/Skill/菜单差异复用各自 profile diff
- 侧栏新增「工作区」入口（主分组第一位）或并入现有页面顶部，二选一在 M1 确认

## 实施里程碑

### M1 数据模型与管理 CRUD

- 扩展 `WorkspaceProfile` 类型与 store
- `core/workspace/workspaceManager.ts`：load/create/copy/rename/delete/set-active
- IPC：`workspace:load-all / create / copy / rename / delete / set-active`
- preload + window.d.ts + 备份收集
- 测试：CRUD、默认保护、active 追踪

### M2 统一预览

- 收集四个子方案摘要（复用各模块 load + diff）
- `core/workspace/buildWorkspacePreview.ts`：环境 + 四方案变更清单
- IPC：`workspace:preview`
- UI：工作区预览弹窗（复用 ColorApplyPreviewDialog 的表格样式）

### M3 统一应用

- `core/workspace/applyWorkspace.ts`：按顺序生成四个 Apply Plan（环境锁一致），逐个执行并汇总结果
- IPC：`workspace:apply`（执行前再次校验 environmentId）
- 失败处理：单个模块失败即停止，已成功模块保留（可逐个撤销），给出明确中文汇总
- 测试：环境漂移拒绝、部分成功、应用后各页刷新

### M4 导航与体验

- 侧栏/页面入口 + 当前工作区状态胶囊
- 切换工作区 = 只预览；点击「应用此工作区」才统一写入
- 用户手册与避坑指南更新

## 风险与边界

- 方案间依赖：快捷键引用 Skill 命令、菜单引用 Skill/快捷键——统一应用顺序必须「Skill → 菜单 → 快捷键」或按引用方向校验，M3 需明确
- 配色为全局资源：应用配色不依赖环境锁定（跨板子复用），但与快捷键等并列时仍显示在预览中
- 跨版本兼容：Skill/菜单方案的 Allegro 版本差异沿用现有兼容预检，不因统一工作区放宽
- 不引入自动应用：任何写入仍经 Apply Plan 确认

## 验收标准（v0.3.0 后）

1. 创建「项目 A」工作区：环境 + 快捷键 + Skill + 菜单 + 配色 一次绑定
2. 切换工作区只预览，不写文件
3. 统一应用后四个页面都显示对应方案且环境锁生效
4. 单一模块失败时停止并明确提示，已应用模块可撤销
5. 备份包含工作区定义，新电脑恢复后工作区可重新选择环境
