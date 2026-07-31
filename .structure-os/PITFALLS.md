# Pitfalls

## PIT-2026-07-02-01: Electron install can lose bundled typings or runtime files

- Area: Electron dependency health, backend TypeScript validation, local runtime boot
- Symptom:
  - `tsc -p tsconfig.electron.json --noEmit` reports `Could not find a declaration file for module 'electron'`
  - `node_modules/electron/electron.d.ts` is missing
  - `node_modules/electron/dist/electron.exe` is missing
- Cause:
  - The installed `electron` package contents can be incomplete for local validation, or binary download can fail independently of package metadata.
- Detection:
  - `Test-Path node_modules/electron/electron.d.ts`
  - `Test-Path node_modules/electron/dist/electron.exe`
  - `npx.cmd electron --version`
- Safe fix:
  1. Reinstall the `electron` package shell so bundled typings are present.
  2. If binary download is blocked, recover the runtime payload separately and restore `path.txt`.
  3. Re-run backend type-check and `npx.cmd electron --version`.
- Avoid:
  - Installing outdated `@types/electron` as a substitute for modern Electron bundled types.

## PIT-2026-07-13-01: 未执行的诊断不能显示为检查通过

- Area: Skill 页面、引用检查、全局状态条
- Symptom:
  - 页面刚打开时引用问题数默认为 0，状态条立即显示“无问题”。
  - 用户无法区分“尚未运行检查”和“检查完成且没有问题”。
- Cause:
  - 只使用问题数组长度表达诊断状态，没有独立记录检查是否成功完成。
- Detection:
  - 在不进入诊断视图、env 缺失或检查失败时查看顶部引用状态。
- Safe fix:
  1. 使用独立的 `checked/loading/error` 状态。
  2. 只有成功完成检查后，0 个问题才显示“检查通过”。
  3. env 缺失、解析失败和 IPC 失败必须保持“尚未检查”并展示错误。
- Avoid:
  - 把空数组同时解释为“尚未加载”和“检查无问题”。

## PIT-2026-07-13-02: Apply Plan 预览与执行器的步骤协议必须一致

- Area: Skill Profile、Apply Plan、IPC 执行链
- Symptom:
  - 页面能显示方案步骤，但确认执行后没有写入 Skill profile 或 loader，仍可能返回成功。
- Cause:
  - 方案生成器输出 `update_json/write_file`，却交给只识别旧 Skill toggle 步骤的执行器。
- Detection:
  - 对比生成计划的 step type、target 字段与执行器 switch 分支；检查执行后目标文件内容。
- Safe fix:
  1. 使用统一 `createApplyPlan` 生成完整计划。
  2. 为模块提供校验 module 的专用执行 IPC，并调用统一 `executeApplyPlan`。
  3. 生成阶段必须提供真实 `after` 内容，执行后刷新 UI。
- Avoid:
  - 仅凭 `module: skill` 假设任意 Skill 执行器都能识别计划中的步骤。

## PIT-2026-07-13-03: 固定高度工作区的滚动链不能中断

- Area: Skill 页、Menu 页、弹性布局、详情分栏、数据表格
- Symptom:
  - 列表只显示少数几行且无法在表格内滚动。
  - 点击记录后主列表被挤压或消失，详情区旁边出现大片空白。
- Cause:
  - 上层 flex 容器缺少 `min-height: 0`，子级 `overflow: auto` 无法获得确定的剩余高度。
  - 分栏使用负 margin 穿透外层 padding，宽度计算与实际内容区不一致。
- Detection:
  - 在 1346×913 窗口下检查页面、主区、列表区和表格包装层的 `height/min-height/overflow` 计算值。
  - 点击 Skill 后检查两列宽度之和是否超过实际内容区。
- Safe fix:
  1. 从页面根容器到列表包装层连续设置 `height: 100%` / `min-height: 0`。
  2. 让页头和筛选区 `flex: 0 0 auto`，列表区 `flex: 1`并在表格包装层设置 `overflow: auto`。
  3. 详情区使用内容区栅格和相对宽度；宽度不足时切换为弹窗。
  4. Menu 树、属性面板和预览区同样必须从页面根到内部滚动容器连续传递 `min-height: 0`，避免固定像素高度。
- Avoid:
  - 只给最内层表格加 `overflow: auto`。
  - 用负 margin 和 `calc(100% + padding)` 强行拉宽整个页面。

## PIT-2026-07-13-04: 多文件 Skill 不能按每个源文件分别建模

- Area: Skill 扫描、目录包、加载状态
- Symptom:
  - `loader`、`main`、`module_*` 同时出现在 Skill 列表。
  - 包内模块成批显示“已启用未加载”。
- Cause:
  - 扫描器把子目录里的每个源文件都当成独立 Skill。
  - 加载检查只查启动源的第一层 `load`，没有跟踪入口文件内的二级加载。
- Safe fix:
  1. 子目录含多个 Skill 文件时建模为单个 `directory_package`。
  2. 按显式入口、loader、main 的优先级选择被加载文件。
  3. 聚合解析所有包内文件，但只对外展示一个 Skill。
  4. 递归跟踪可静态解析的 `load` 链，并保留运行态验证边界。
- Avoid:
  - 以文件数代替 Skill 数。
  - 把“扫描到文件”等同于“已在 Allegro 启动时配置加载”。
