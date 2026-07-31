# Task 4 报告：键位编辑子页落地

## 实现内容

- 新建 `src/components/hotkeys/HotkeyEditorPanel.tsx`
  - 将 `/hotkeys/editor` 从占位块替换为真实编辑工作区。
  - 复用现有 `HotkeyMap`、`HotkeyList`、`HotkeyEditor`、`AddHotkeyDialog`、`RawLineView`、`EditApplyPlanPreview`。
  - 提供真实搜索、筛选、地图浏览、列表浏览、选中详情、编辑入口、来源修正入口、原始行查看入口。
  - 新增本地编辑计划流：编辑/新增先生成 edit plan，再确认执行，执行后刷新共享工作区数据。
- 修改 `src/pages/HotkeyWorkspacePage.tsx`
  - 接入新的 `HotkeyEditorPanel`。
  - 删除原先 editor 路由的占位实现。
  - 给共享 actions 最小补充 `reloadData`，供编辑计划执行成功后刷新数据。
- 修改 `src/components/hotkeys/types.ts`
  - 最小扩展 `HotkeyWorkspaceActions`，增加 `reloadData: () => Promise<void>`。
- 修改 `src/App.css`
  - 为编辑子页补充最小布局样式，保持当前白色极简方向，不做“大框套小框”。
- 修改 `tests/hotkeyWorkspacePanels.test.tsx`
  - 补充 editor 路由真实渲染测试，验证标题、搜索框、地图区、列表区和新增入口存在。
  - 保持现有 `KeyboardVisualizer` mock 不回退。

## TDD 记录

### RED

- 先新增测试：
  - `renders editor route with search, map/list area and edit actions`
- 运行：
  - `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
- 结果：
  - FAIL
  - 失败原因符合预期：`/hotkeys/editor` 仍然是占位内容，找不到搜索框。

### GREEN

- 接入真实 `HotkeyEditorPanel` 后再次运行：
  - `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
- 中途出现一次小收口：
  - 编辑页已渲染，但“快捷键地图”文本因为旧组件标题带图标，测试命中不稳定。
  - 通过补明确 section title 修正。
- 最终结果：
  - PASS，4/4 tests passed

## 运行的测试与结果

- `Test-Path .git`
  - 输出：`False`
- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
  - 结果：通过，4/4
- `npx.cmd tsc --noEmit`
  - 结果：通过
- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
  - 结果：通过

## 改动文件清单

- `src/components/hotkeys/HotkeyEditorPanel.tsx`
- `src/pages/HotkeyWorkspacePage.tsx`
- `src/components/hotkeys/types.ts`
- `src/App.css`
- `tests/hotkeyWorkspacePanels.test.tsx`

## 自检结论

- `/hotkeys/editor` 已经不是占位块，而是可工作的真实编辑子页。
- 已满足本任务强调的“地图/列表/搜索/编辑入口”落地目标。
- 继续保持 `/hotkeys/overview` 可用，`conflicts / import-export` 未被扩写或回退。
- 改动范围控制在任务允许文件及最小共享契约扩展内，未触碰 core/electron/IPC 协议。

## 遗留担忧

- 当前“新增绑定”仍依赖先选中一个现有绑定，以便复用其 `physicalKey` 打开旧 `AddHotkeyDialog`。这保证了最小真实接入，但还不是独立完整的新建流程。
- `currentProfileBindings` 传给旧 `HotkeyEditor` 时沿用了老页里相同的宽松兼容思路（类型上做最小断言），行为上可工作，但后续如果要继续深做编辑流，最好统一 profile binding 和 `HotkeyBinding` 的建模边界。

## Reviewer 定向修复（第二轮）

### 修复内容

- 修复 1：`新增绑定` 不再依赖先选中已有 binding
  - `HotkeyEditorPanel` 新增轻量“物理键选择”弹窗。
  - 当已有选中 binding 时，仍可直接复用其 `physicalKey` 进入旧 `AddHotkeyDialog`。
  - 当没有任何选中 binding，或空工作区时，点击“新增绑定”会先弹出物理键输入/快捷选择，再进入 `AddHotkeyDialog`。
  - 这样保留了旧新增弹窗，不扩写 Task 5/6，同时补齐 reviewer 点名的空工作区路径。
- 修复 2：加强 `tests/hotkeyWorkspacePanels.test.tsx`
  - 将 editor 路由测试从“不是占位块”加强为“真实共享数据已接入”：
    - 验证编辑页能渲染来自共享容器的真实 binding 数据。
    - 验证点击真实列表/地图项后，右侧详情与“编辑此绑定”入口可用。
    - 验证点击“编辑此绑定”会打开旧 `HotkeyEditor` 弹窗。
  - 增加无已有 binding 场景测试：
    - 验证空工作区下点击“新增绑定”会打开“选择物理键”弹窗。
    - 验证填写物理键并继续后，会进入真实 `AddHotkeyDialog`。

### 第二轮 TDD 记录

#### RED

- 先补两条行为测试：
  - `renders editor route with shared binding data and opens editor from selection`
  - `allows adding a binding without preselecting an existing binding`
- 运行：
  - `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
- 首次结果：
  - FAIL
  - 失败原因符合预期：
    - 旧实现下“新增绑定”按钮仍依赖已选 binding。
    - 行为测试也暴露了 editor 页真实接线和 layer 过滤样本需要收紧。

#### GREEN

- 补入轻量物理键选择路径后，重新运行同一测试文件。
- 中途做过一次小修正：
  - 测试样本从 `Ctrl+A` / `A` 收口为能稳定通过 `normal` layer 的 `a`，避免误测到层过滤规则本身。
  - 文本查询从单值查询调整为 `findAllByText`，避开地图和列表重复渲染带来的歧义。
- 最终结果：
  - PASS，5/5 tests passed

### 第二轮验证结果

- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
  - 结果：通过，5/5
- `npx.cmd tsc --noEmit`
  - 结果：通过
- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
  - 结果：通过
- `Test-Path .git`
  - 输出：`False`

### 第二轮补充自检

- reviewer 点名的两个 Important 都已覆盖到：
  - 空工作区 / 无已有 binding 可新增
  - 编辑页测试不再只停留在标题存在，而是覆盖真实共享数据、点击驱动详情、打开编辑入口

### 第二轮遗留担忧

- 当前物理键选择路径是“轻量输入 + 快捷按钮”方案，可靠但还不是完整键盘可视化选键器；这符合本轮“最小可靠方案”的范围控制。
