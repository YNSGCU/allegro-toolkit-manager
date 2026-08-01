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

- Area: Hotkey 页、Skill 页、Menu 页、弹性布局、详情分栏、数据表格
- Symptom:
  - 列表只显示少数几行且无法在表格内滚动。
  - 点击记录后主列表被挤压或消失，详情区旁边出现大片空白。
  - Hotkey 编辑或冲突页底部超出固定工作区后被裁切，窗口没有任何可用的纵向滚动条。
- Cause:
  - 上层 flex 容器缺少 `min-height: 0`，子级 `overflow: auto` 无法获得确定的剩余高度。
  - 分栏使用负 margin 穿透外层 padding，宽度计算与实际内容区不一致。
  - 外层 contained 工作区使用 `overflow: hidden`，但 Hotkey 内容区没有承担纵向滚动。
- Detection:
  - 在 1346×913 窗口下检查页面、主区、列表区和表格包装层的 `height/min-height/overflow` 计算值。
  - 点击 Skill 后检查两列宽度之和是否超过实际内容区。
  - 在 1220×820 下分别打开 Hotkey 编辑、冲突和导入导出页，确认内容区 `scrollHeight` 可通过自身 `overflow-y: auto` 完整到达。
- Safe fix:
  1. 从页面根容器到列表包装层连续设置 `height: 100%` / `min-height: 0`。
  2. 让页头和筛选区 `flex: 0 0 auto`，列表区 `flex: 1`并在表格包装层设置 `overflow: auto`。
  3. 详情区使用内容区栅格和相对宽度；宽度不足时切换为弹窗。
  4. Menu 树、属性面板和预览区同样必须从页面根到内部滚动容器连续传递 `min-height: 0`，避免固定像素高度。
  5. Hotkey contained 工作区由 `.hotkey-workspace-content` 统一承担纵向滚动，键盘容器只承担局部横向滚动。
- Avoid:
  - 只给最内层表格加 `overflow: auto`。
  - 用负 margin 和 `calc(100% + padding)` 强行拉宽整个页面。
  - 在 `overflow: hidden` 的固定页面中让路由内容自然增高，却没有指定内部滚动所有者。

## PIT-2026-08-01-05: 悬浮卡方向不能依赖固定视口阈值

- Area: 快捷键键盘、悬浮说明、响应式布局
- Symptom:
  - F1–F12 等上排键的悬浮卡总是向上展开，遮住页签、状态条或方案栏。
  - 改变窗口高度或页头密度后，原本正常的键位再次出现遮挡。
- Cause:
  - 使用 `rect.top < 190` 这类视口绝对阈值判断方向，阈值与键盘在页面中的实际位置无关。
- Detection:
  - 模拟键盘容器和上排键的 `getBoundingClientRect()`，悬停 F1 并检查悬浮卡是否使用 `--below` 方向。
  - 在 1220×820 与 1600×856 下确认上部键位向下展开、下部键位向上展开。
- Safe fix:
  1. 读取最近的 `.keyboard-wrapper` 边界。
  2. 用键位相对键盘高度的位置决定方向，并保留视口阈值作为无容器时的回退。
  3. 对上排键方向增加组件测试，避免布局调整后复发。
- Avoid:
  - 用固定像素值猜测键盘所在区域。
  - 只改变悬浮卡 `z-index`；这会让遮挡更明显，并没有修正方向。

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

## PIT-2026-08-01-06: Grid 子项的固有宽度会绕过外层响应式收缩

- Area: 快捷键键盘、CSS Grid、窄窗口布局
- Symptom:
  - 页面没有水平滚动条，但键盘卡片向右越过主内容区，右侧“Skill”筛选或 F12/Bksp 被裁切。
  - 外层 Grid 已在媒体查询中切为 `1fr`，计算列宽仍大于容器宽度。
- Cause:
  - 键盘所在 Grid 子项使用默认 `min-width: auto`，其内容固有宽度成为列的最小值。
  - 外层 `overflow: hidden` 隐藏了溢出，因此看起来像是组件内容缺失。
- Detection:
  - 对比 `.hotkey-editor-panel-layout` 与 `.hotkey-editor-map-section` / `.keyboard-visualizer` 的 `getBoundingClientRect().width`。
  - 在 1024×768 和 1220×820 检查 `right <= main.right`，并确认文档宽度等于视口宽度。
- Safe fix:
  1. 给承载宽内容的 Grid/Flex 子项设置 `min-width: 0`。
  2. 保留键盘内部等比例布局或局部滚动，不让固有宽度反向撑大页面列。
  3. 用实际浏览器几何值和截图同时验证，而不只检查页面是否出现水平滚动条。
- Avoid:
  - 只给最外层加 `overflow: hidden` 掩盖越界。
  - 仅修改 `grid-template-columns: 1fr`，却忽略 Grid 子项的默认最小宽度。

## PIT-2026-08-01-07: 页面懒加载必须覆盖 Electron 的生产资源服务

- Area: React 路由、Vite 动态导入、Electron 内嵌 HTTP 静态资源服务
- Symptom:
  - 开发服务器中路由切换正常，打包后的桌面应用首次进入某个页面时却出现空白或“动态模块加载失败”。
- Cause:
  - 路由改为 `React.lazy()` 后会额外请求页面 chunk；生产资源服务、构建基址或发布内容没有覆盖这些新增文件请求。
- Detection:
  - 检查 `vite.config.ts` 是否保持 `base: './'`。
  - 检查生产 `dist/index.html` 的入口路径和异步 chunk 是否都位于相对 `./assets/` 下。
  - 运行 `rendererAssetPath` 测试，确认 Electron 的内嵌 HTTP 服务不会把真实 chunk 请求错误回退到 `index.html`。
  - 逐一打开所有异步路由，确认页面标题出现且没有动态模块请求错误。
- Safe fix:
  1. 保持 Vite `base: './'` 与 Electron 生产资源服务的现有契约一致。
  2. 让应用壳层和加载态同步打包，只把路由页面放入动态导入边界。
  3. 同时运行资源路径测试、生产构建和实际路由切换检查。
- Avoid:
  - 只在开发服务器验证动态导入。
  - 通过提高 `chunkSizeWarningLimit` 隐藏主包过大的问题。

## PIT-2026-08-01-08: 路由错误边界不能按完整子路由重建

- Area: React Router、Error Boundary、页面状态保持
- Symptom:
  - 在快捷键“键位 / 冲突”之间切换时重新读取整页数据，筛选、选中项或临时状态丢失。
- Cause:
  - 错误边界直接使用 `location.pathname` 作为 React key，任何子路由变化都会卸载并重建父工作区。
- Detection:
  - 检查 `/hotkeys/keys` 与 `/hotkeys/conflicts` 的边界 key 是否相同。
  - 切换子页并确认 `HotkeyWorkspacePage` 不会重新挂载或重复装载数据。
- Safe fix:
  1. 用 `getRouteBoundaryKey()` 把子路由归一化为一级工作区根路径。
  2. 只有跨一级工作区时才重建错误边界并清除旧错误。
  3. 为根路径归一化增加单元测试。
- Avoid:
  - 直接把完整 pathname 或导航计数器用作错误边界 key。
  - 为消除旧错误而牺牲父页面状态保持。

## PIT-2026-08-01-09: Electron 实机巡检不能只依赖窗口截图

- Area: Electron、Windows UI Automation、生产资源与 preload 验证
- Symptom:
  - Electron 窗口已打开，但截图接口返回“不支持此接口”，默认可访问性树只包含标题栏和空文档。
  - 首次观察只看到 Suspense 加载态，容易误判异步页面 chunk 永久卡住。
- Root cause:
  - 当前 Windows 图像捕获接口不能稳定捕获该 Electron 窗口；Electron 默认也未强制暴露完整 renderer 可访问性树。
  - 页面 chunk、preload 和首次 IPC 读取需要短暂异步时间，单次快照不是完成状态。
- Wrong attempts:
  - 重复使用失败截图的坐标或元素索引。
  - 看到一次“正在加载工作区”就判断动态导入失败。
- Correct fix:
  1. 测试启动时增加 `--force-renderer-accessibility`，重新获取当前窗口句柄。
  2. 等异步加载完成后重新读取可访问性树，确认页面标题、preload 数据和真实业务记录出现。
  3. 同时检查 Electron 内嵌 HTTP 端口的入口、CSS 和页面 chunk 响应，以及进程控制台日志。
- Guardrail:
  - 截图失败后停止复用旧坐标；Electron 实机结论至少包含“资源响应 + preload 注入 + 页面业务数据”三项证据。
- Related files:
  - `electron/main.ts`
  - `electron/rendererAssetPath.ts`
  - `src/App.tsx`
- Detection:
  - 启动生产构建，确认可访问性树从“正在加载工作区”更新到具体工作区与数据记录。
- Verification:
  - 本轮验证到快捷键页显示 env 已连接、113 条配置和真实快捷键列表；控制台未出现页面错误。
- Last seen: 2026-08-01
