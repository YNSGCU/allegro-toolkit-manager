# 快捷键工作台拆分设计

## 背景

当前 [HotkeyPage.tsx](C:/Users/89539/Documents/ClaudeCode/AllegroDevOpsTool/src/pages/HotkeyPage.tsx) 同时承载了以下职责：

- 方案选择与应用状态
- 键盘占用总览
- 快捷键地图与搜索筛选
- 明细表格
- 冲突诊断
- 导入导出
- 变更历史、收藏、原始行查看、编辑弹窗

这导致页面虽功能完整，但使用时有明显的“一页大杂烩”问题：

- 用户进入页面后，不容易快速判断当前主任务
- 总览、编辑、诊断、交换数据四类操作混在一起
- 键盘、地图、列表、冲突四大区块同时出现，视觉重心过散
- 后续继续扩展时，`HotkeyPage.tsx` 会进一步膨胀

用户已确认采用 `B. 主工作台 + 二级页` 方案，即保留“快捷键”作为一级模块，但在模块内部拆成清晰的子工作区。

## 目标

本次改版的目标是：

1. 把“快捷键”从单页巨石界面拆成“总览 + 二级工作区”的结构。
2. 让每个子页面只承担一个主任务：看总览、改键位、处理冲突、导入导出。
3. 保持现有核心逻辑、IPC、Apply Plan、编辑弹窗和校验能力可复用。
4. 尽量通过路由拆分、容器重组和组件复用完成改造，而不是重写整套功能。
5. 让快捷键页风格与当前白色极简主题一致，不再出现一页堆满所有功能的情况。

## 非目标

本轮不做以下内容：

- 不重写 `core/`、`electron/`、IPC 协议
- 不改动快捷键解析与校验规则本身
- 不新增新的业务能力，只重组入口和页面结构
- 不把所有弹窗改成新交互模式
- 不同步重构 Skill / 菜单页，只为后续统一留出结构参考

## 设计结论

### 一级导航不变

应用左侧一级导航继续保留：

- 快捷键
- Skill
- 菜单
- 概览
- 环境

不新增左侧一级入口，避免产品导航继续膨胀。

### 快捷键内部改为四个子工作区

“快捷键”模块内部拆成以下四个子页面：

1. `快捷键总览`
2. `键位编辑`
3. `冲突处理`
4. `导入导出`

默认进入 `快捷键总览`。

## 信息架构

### 路由建议

保留一级路由 `/hotkeys`，在其内部拆子路由：

- `/hotkeys`
  - 默认重定向到 `/hotkeys/overview`
- `/hotkeys/overview`
- `/hotkeys/editor`
- `/hotkeys/conflicts`
- `/hotkeys/import-export`

这样做的好处：

- 左侧一级导航保持稳定
- 快捷键模块可以形成自己的二级导航
- 用户切换子任务时有明确 URL 与状态落点
- 后续 Skill / 菜单页也可以沿用同样模式

## 页面职责

### 1. 快捷键总览

这是“入口页”，只回答三个问题：

- 我当前在操作哪个方案
- 这套方案整体状态如何
- 下一步应该去哪里处理

页面内容应包括：

- 页面标题与一句简洁描述
- `ProfileBar`
- 一行核心状态胶囊
  - 快捷键数
  - 冲突数
  - 保留键覆盖风险
  - 当前 env
  - 应用状态
- 一块简洁的键盘占用总览
- 三张入口卡片
  - 去编辑键位
  - 去处理冲突
  - 去导入导出

页面内容不应包括：

- 大型快捷键地图
- 大型明细表格
- 全量冲突列表
- 导入预览弹窗主体内容

### 2. 键位编辑

这是“干活页”，只做键位查找与修改。

页面内容应包括：

- 子页标题与当前说明
- `ProfileBar`
- 必要状态胶囊
- 搜索与筛选
- 快捷键地图 / 列表切换
- 键位详情区
- 新增、编辑、删除、收藏、来源修正

优先保留的现有能力：

- `HotkeyMap`
- `HotkeyList`
- `HotkeyEditor`
- `AddHotkeyDialog`
- 原始行查看

页面内容不应包括：

- 大盘统计
- 全量冲突诊断主视图
- 导入导出工具集合

### 3. 冲突处理

这是“诊断页”，只做问题发现与处理闭环。

页面内容应包括：

- 子页标题与当前冲突摘要
- `ProfileBar`
- 问题状态胶囊
- `EnhancedConflictList`
- 保留键覆盖风险说明
- 相关键位的快捷跳转入口
- Apply Plan 前检查摘要

优先保留的现有能力：

- `EnhancedConflictList`
- `ConflictList` 中可复用的轻量逻辑
- 跳转到编辑指定绑定
- 原始行定位

页面内容不应包括：

- 键盘总览作为主视觉
- 快捷键地图作为主编辑区
- 导入导出操作集合

### 4. 导入导出

这是“数据交换页”，只处理输入输出。

页面内容应包括：

- 子页标题与说明
- `ProfileBar`
- 导入 env
- 导入方案
- 导出方案
- 导出速查表
- 导入预览、冲突说明、执行结果

优先保留的现有能力：

- `ImportPreviewDialog`
- `EnvImportDialog`
- `ExportCheatsheetDialog`
- 历史与回滚入口

页面内容不应包括：

- 日常编辑区
- 大型键盘占用图
- 冲突诊断主列表

## 二级导航设计

快捷键模块顶部增加二级工作区导航，建议为简洁文字标签，不做大色块按钮：

- 总览
- 编辑
- 冲突
- 导入导出

规则：

- 只在快捷键模块内部显示
- 位于页面标题下方、方案栏上方或与方案栏形成连续区块
- 激活态使用当前主题色，非激活态保持轻量
- 不做卡片式大切换器，避免再次出现“大框套小框”

## 状态与数据策略

### 数据加载保持单源

现有 `HotkeyPage` 的数据加载已经较完整，建议拆分时仍由一个上层容器负责：

- 环境定位
- env 解析
- 绑定校验
- 收藏状态
- 方案状态
- 引用 env
- 冲突集合

建议新增一个容器层，例如：

- `HotkeyWorkspacePage` 负责统一加载与共享状态
- 四个子页面只消费整理后的数据

这样能避免：

- 四个子页面各自重复请求
- 页面切换造成状态丢失
- 多处维护同一套副作用

### 容器与展示分层

建议拆分为：

- `HotkeyWorkspacePage`
  - 数据加载、状态聚合、事件分发
- `HotkeyOverviewPanel`
- `HotkeyEditorPanel`
- `HotkeyConflictsPanel`
- `HotkeyImportExportPanel`

这样能先完成结构拆分，再视需要逐步把原 `HotkeyPage.tsx` 逻辑搬迁出去。

## 现有组件复用策略

### 优先复用

以下组件优先保留并重新挂载：

- `ProfileBar.tsx`
- `GlobalStatusBar.tsx`
- `KeyboardVisualizer.tsx`
- `HotkeyMap.tsx`
- `HotkeyList.tsx`
- `EnhancedConflictList.tsx`
- `MoreActionsMenu.tsx`
- `HotkeyEditor.tsx`
- `AddHotkeyDialog.tsx`
- `ImportPreviewDialog.tsx`
- `EnvImportDialog.tsx`
- `ExportCheatsheetDialog.tsx`

### 建议新增

建议新增以下组件文件：

- `src/components/hotkeys/HotkeySubnav.tsx`
- `src/components/hotkeys/HotkeyOverviewPanel.tsx`
- `src/components/hotkeys/HotkeyEditorPanel.tsx`
- `src/components/hotkeys/HotkeyConflictsPanel.tsx`
- `src/components/hotkeys/HotkeyImportExportPanel.tsx`

建议新增以下页面或容器文件：

- `src/pages/HotkeyWorkspacePage.tsx`

是否保留原 [HotkeyPage.tsx](C:/Users/89539/Documents/ClaudeCode/AllegroDevOpsTool/src/pages/HotkeyPage.tsx)：

- 建议保留并转为轻量包装层，或直接让其退役为 `HotkeyWorkspacePage`
- 不建议继续在原文件上叠加更多条件渲染

## 交互规则

1. 总览页不直接承载重编辑区。
2. 编辑页进入后，默认把重心放在查找与修改，不展示全量诊断块。
3. 冲突页中的每条问题都应能跳转或联动到对应编辑目标。
4. 导入导出页应明确区分“读入数据”和“写出数据”，避免操作混淆。
5. 应用方案入口只保留在需要的页面中，不强迫四页都重复出现大主按钮。

## 视觉规则

本次拆分延续当前白色极简主题，重点约束如下：

- 不使用大面积大圆角功能块去包住所有内容
- 入口卡片数量要少，优先做“导航卡片”而非“功能清单墙”
- 二级导航要轻，不做后台系统式标签页堆叠
- 每个子页只保留一个主视觉重心
  - 总览页：键盘总览
  - 编辑页：地图/列表
  - 冲突页：冲突列表
  - 导入导出页：操作区

## 测试与验证

本次改版完成后，至少需要验证：

- 快捷键模块默认能进入 `/hotkeys/overview`
- 四个子路由可正常切换
- 共享数据在子页面切换后不丢失
- 编辑、冲突跳转、导入导出弹窗仍能正常工作
- 现有 `pageSurfaces` 与导航测试按新结构更新
- `npm test`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
- `npm run build:renderer`

## 风险与取舍

### 风险

- [HotkeyPage.tsx](C:/Users/89539/Documents/ClaudeCode/AllegroDevOpsTool/src/pages/HotkeyPage.tsx) 当前体量较大，直接硬拆有引入回归的风险
- 原页面中有大量弹窗和局部状态，拆分时容易出现状态归属混乱
- 现有测试更多覆盖数据与壳层，对快捷键页面内部结构覆盖不足

### 取舍

- 第一轮先做“结构拆分 + 入口重排 + 组件复挂”，不做所有内部组件深度重写
- 第一轮允许局部子页面仍复用旧逻辑块，只要用户感知上已经不是“一页全塞”
- Skill / 菜单页本轮不跟拆，但后续可以复用同一模式

## 实施建议

建议分两步推进：

### 第一步

- 建立快捷键内部子路由
- 抽出共享容器
- 落地四个子页面骨架
- 迁移总览、编辑、冲突、导入导出各自的现有区块

### 第二步

- 清理原 `HotkeyPage.tsx`
- 继续细化每个子页的视觉节奏
- 视需要补更多页面级测试

## 备注

仓库当前不是 Git 仓库，因此本设计稿无法按技能要求提交 commit，只能先保存到文档目录。
