# 统一工作区方案（Workspace Unified Profile）设计

> 状态：已完成（M1–M4 + V6.2 导入导出 + V6.3 引用校验与换机重绑）
> 更新：2026-08-29

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

## 当前功能链

```text
UnifiedWorkspacePage
  → workspace:binding-options / workspace:update
  → workspaceManager.updateWorkspace
  → workspaces.json 原子写入
  → 页面 reload

应用目标卡片
  → workspace:apply-plan（目标 workspaceId + 当前环境锁）
  → applyTarget 固定确认对象
  → Skill → 菜单 → 快捷键 → 配色
  → 各模块主进程可信计划校验 / 环境漂移校验 / 备份回滚
  → 中文逐步结果与准确完成数
```

新增 IPC：

- `workspace:binding-options`：按目标环境加载环境及四类方案候选项。
- `workspace:update`：校验候选项存在后更新组合关系。

工作区存储使用同目录临时文件写入后原子替换。保存失败会向 IPC 抛错，禁止 Renderer 显示假成功。默认工作区和当前使用中的工作区均不可删除。

## Apply Plan 信任边界

`electron/ipc/trustedApplyPlan.ts` 为 Menu、Skill Profile 和 Vibe Bridge 启用计划维护主进程内的一次性快照。Renderer 返回确认结果时必须同时满足：

1. plan ID 由当前主进程生成且未过期；
2. IPC 作用域和模块一致；
3. JSON 内容与主进程快照完全一致；
4. 每个 plan ID 只能消费一次。

因此 Renderer 可以展示计划，但不能修改目标路径、步骤或跨通道复用计划。

## V6.3 跨模块引用一致性校验

新增 `core/workspace/workspaceReferenceCheck.ts`（纯函数），校验「菜单方案 / 快捷键方案」
引用的命令是否由目标 Skill 方案中**已启用**的 Skill 提供：

- Allegro 内置命令：跳过（视为满足）
- 已启用 Skill 提供的命令：通过
- 仅由**未启用** Skill 提供的命令：warning（应用目标 Skill 方案后命令将失效，提示提供者）
- 找不到任何提供者且非内置命令：warning（可能是内置命令表未收录或 Skill 缺失）

校验结果只做提示（`blocked=false`），是否阻断仍由各模块自身的校验决定。
输入由 IPC 层组装：快捷键绑定、菜单项（含完整路径）、Skill 方案启用的 skillId 集合、
环境中扫描到的全部 Skill 命令（`scanAllSkills` + 函数名，覆盖公司/用户/ATM 三层）。

```text
卡片「引用校验」→ workspace:check-refs
  → 目标环境 locateEnvironment + skill 扫描
  → checkWorkspaceReferences（纯函数）
  → 弹窗：汇总计数 + 逐条来源/命令/详情
```

## V6.3 导入重绑（换机迁移）

导出的工作区包只含组合关系；换机导入时子方案 ID 在本机通常不存在。

- 导出时额外写入各子方案**显示名**（`hotkeyProfileName` 等，向后兼容，旧包无名字段）
- `workspace:import-open` 调用 `resolveWorkspaceImportBindings`：对本机已有方案按
  「名称相似度」评分（`scoreNameSimilarity`：完全一致 100 / 原始包含 80 / 去符号一致 90 /
  去符号包含 70），按分数排序取前 5 作为候选，取最高分为推荐
- 导入确认弹窗对缺失的子方案展示下拉（默认选推荐），确认时通过
  `workspace:import-commit(filePath, name, remap)` 传入重绑映射；
  `applyWorkspaceImport(pkg, name, remap)` 仅覆盖 remap 指定的字段，其余保持原 ID

```text
workspace:export
  → buildWorkspaceExportPackage(workspace, names)（组合关系 + 子方案名）
workspace:import-open
  → parseWorkspaceExportPackage → previewWorkspaceImport
  → resolveWorkspaceImportBindings（存在性 + 候选 + 推荐）→ 保存到 preview.resolutions
workspace:import-commit(filePath, name, remap)
  → applyWorkspaceImport(pkg, name, remap) → 新工作区（重名自动加「（导入）」）
```
