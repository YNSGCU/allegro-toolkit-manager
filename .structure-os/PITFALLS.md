## PIT-2026-08-11-01: 页面导航必须执行菜单草稿离开保护

- Area: 菜单页面、React Router、侧栏导航、`menu:save-draft`
- Symptom: 用户编辑菜单后切换到其他页面，再返回菜单页时，未应用的菜单项消失。
- Root cause: 菜单页只在菜单方案切换和 Allegro 环境切换时调用草稿保存；侧栏 `NavLink` 直接卸载页面，React 状态中的草稿没有进入 `menu_profile.json`。
- Wrong attempts: 只在菜单页显示“未保存”状态；依赖页面卸载时异步保存；只保护 Allegro 环境切换而忽略普通页面导航。
- Correct fix: 侧栏导航先运行现有 `environmentSwitchGuard`，保存成功后再导航；菜单页内部跳转到关联 Skill/快捷键也运行同一保护。
- Guardrail: 任何会卸载菜单页的导航入口都必须先执行页面离开保护；保存失败或校验失败时保持当前路由和草稿不变。
- Related files: `src/components/Layout.tsx`, `src/pages/MenuPage.tsx`, `src/services/environmentSwitchGuard.ts`, `tests/layoutPrefetch.test.tsx`
- Detection: 编辑菜单后点击侧栏 Skill/快捷键/其他页面，返回菜单页确认草稿仍在；模拟保存失败确认路由不变。
- Verification: `tests/layoutPrefetch.test.tsx`、`tests/environmentSwitchGuard.test.ts`、`tests/menuWorkspace.test.tsx`。
- Last seen: 2026-08-11

## PIT-2026-08-10-01: 菜单方案下拉状态与编辑对象必须同步，切换前必须保存

- Area: 菜单方案、React 页面状态、Allegro 环境切换、`menu_profile.json`
- Symptom: 用户编辑或复制菜单方案后，切换方案/Allegro 版本再返回，菜单项消失；下拉框显示“副本”，但编辑器实际仍持有旧方案对象。
- Root cause: Profile CRUD 只更新 `store`，没有同步 `profile/items/savedItemsJson`；方案和环境切换直接替换状态或刷新页面，没有先保存未提交草稿。不同 Allegro 环境各自拥有独立 `menu_profile.json`，又让已保存在 17.4 的菜单看起来像在 17.2 丢失。
- Wrong attempts: 把所有版本改成共享同一文件；切换时静默丢弃草稿；仅修改状态标签；自动复制来源环境而不给用户审阅。
- Correct fix: CRUD/切换后从返回仓库统一重建页面状态；方案或环境切换前调用现有草稿保存并在失败时阻止切换；跨环境复用必须由用户显式生成可信 Apply Plan，只复制非空方案到目标环境草稿。
- Guardrail: 任何 `store + activeId + activeObject + editableItems + savedSnapshot` 组合都必须由一个同步函数更新；所有会卸载页面或替换活动对象的入口必须先处理未保存状态。跨环境写入必须锁定来源和目标，禁止静默共享或复制。
- Related files: `src/pages/MenuPage.tsx`, `src/services/environmentSwitchGuard.ts`, `src/components/AllegroEnvironmentSwitcher.tsx`, `electron/ipc/menu.ipc.ts`, `core/menu/menuManager.ts`
- Detection: 创建/复制方案后编辑菜单，分别切换菜单方案和 17.2/17.4；保存失败时活动目标不得改变。当前环境为空而其他环境有数据时，应出现“复制到当前”并打开 Apply Plan。
- Verification: `tests/menuManager.test.ts`、`tests/environmentSwitchGuard.test.ts`、`tests/menuWorkspace.test.tsx`、`tests/environmentSwitcher.test.tsx`。
- Last seen: 2026-08-10

## PIT-2026-08-06-01: 菜单拖动排序必须限制在同级

- Area: 菜单树、React 递归组件、HTML5 Drag and Drop
- Symptom: 能看到拖动影子，但目标行没有反馈，松开后顺序不变；把上方相邻项拖到下方项时也可能保持原顺序。
- Root cause:
  - 每个递归行各自保存 `draggedId`，目标行无法读取源行 state。
  - Chromium 在 `dragover` 的 protected mode 下可能让 `DataTransfer.getData()` 返回空字符串。
  - 删除源项后重新查找目标索引并插到目标之前，会让“上方向下拖到相邻项”成为无变化操作。
- Correct fix:
  1. 在 `MenuTree` 顶层共享 `{ id, parentId }` 和 `dropTargetId`，递归行只消费共享状态。
  2. `dragover` 只根据共享 parentId 判断是否接受，不能依赖读取 DataTransfer payload。
  3. 使用删除前的目标索引插入，使向下拖动落在目标之后、向上拖动落在目标之前。
  4. 目标行必须显示整行强调反馈；拖动结束、放置或取消时统一清理状态。
- Guardrail: 只接受同一 `parentId` 下的目标项；跨层级拖动忽略。层级变更必须使用显式编辑动作并经过菜单验证。
- Related files: `src/components/MenuTree.tsx`, `src/utils/menuTreeOrder.ts`, `tests/menuWorkspace.test.tsx`, `tests/menuTreeOrder.test.ts`
- Detection: 模拟 `dragover` 阶段 `getData()` 返回空，确认目标行仍可接受放置；覆盖上方向下、下方向上和跨父级三种排序。
- Verification: 拖动只修改草稿，仍必须保存草稿并生成、执行菜单 Apply Plan。
- Last seen: 2026-08-08

## PIT-2026-08-08-01: 配色图层列表的 flex 容器会压缩子项

- Area: 配色页面、图层列表、CSS
- Symptom: 图层多（498 行）时右侧列表行全部变细条，滚动区 `scrollHeight === clientHeight`，看起来像内容被折叠。
- Cause: `.color-layers-groups` 是 `flex-direction: column + max-height + overflow-y: auto`，子项默认 `flex-shrink: 1` 被压进容器。
- Safe fix: 子项 `.color-layer-group` 加 `flex-shrink: 0`；验证 `scrollHeight > clientHeight` 和子项真实高度。
- Avoid: 只检查横向溢出；不要用固定像素高度猜测内容。

## PIT-2026-08-08-02: 捕获可见性必须用 axlIsVisibleLayer

- Area: 配色捕获、Vibe Bridge、SKILL
- Symptom: `lp->visibility`（axlLayerGet 返回对象属性）实测全部返回 nil，方案中 498 个图层全部显示"隐藏"。
- Cause: layer DBID 上未经验证的字段名不可靠。
- Safe fix: 捕获脚本使用 `axlIsVisibleLayer("CLASS/SUBCLASS")`，`axlLayerGet` 只用于颜色等属性。
- Avoid: 依赖 layer 对象的未验证属性名。

## PIT-2026-08-08-03: 配色局部更新必须保留元数据

- Area: 配色方案、IPC 更新、图层/调色板合并
- Symptom: 只提交 `{className, subclassName, colorIndex}` 会把图层的 `visible/layerType` 覆盖丢失；只提交 `{index, rgb}` 会丢掉调色板 `name`。
- Safe fix: 以已有条目为基底合并：图层保留 `className/subclassName`，调色板保留 `index`；页面传完整条目。
- Avoid: 在 IPC 合并层只做浅展开覆盖。

## PIT-2026-08-08-04: 单层自定义颜色不能改写共享索引

- Area: 配色页面、自定义颜色、调色板索引
- Symptom: 直接改写图层当前 `colorIndex` 对应的调色板颜色，会让所有共享该索引的图层一起变色。
- Safe fix: 按 `createCustomLayerColorPlan` 优先级：匹配 RGB 复用 → 当前索引独占时安全改写 → 占用未使用索引 → 无安全空位时拒绝并提示。
- Avoid: 无防护地直接覆盖调色板条目。

## PIT-2026-08-08-05: Electron 实机巡检可用 CDP 端口替代可见窗口

- Area: Electron 实机巡检、渲染进程验证
- Symptom: 打包版 ATM.exe 在非交互会话中启动后进程存在但没有可见窗口，`MainWindowHandle` 为 0，无法用 UIAutomation 读窗口树。
- Cause: 会话没有交互桌面，窗口创建后不可见；但渲染进程与内嵌 HTTP 服务仍正常运行。
- Safe fix: 以 `--remote-debugging-port=9333 --force-renderer-accessibility` 启动，通过 CDP `/json` 找到 page target，检查 `window.atm` 注入、路由标题、真实业务数据与控制台错误。本次已确认：preload 注入 154 个 API、快捷键页 113 条真实绑定、配色页 ceshi 方案加载、备份页按钮正常。
- Avoid: 仅凭 `MainWindowHandle` 或截图判断应用是否可用；也避免在窗口不可见时重复 UIAutomation 尝试。

# Pitfalls

## PIT-2026-08-01-10: 不同历史 JSON 结构不能共用同一个文件

- Area: Apply Plan、快捷键历史、Skill/Menu 撤销
- Symptom: 菜单或 Skill 应用后再编辑快捷键，历史读取报错或旧记录被覆盖。
- Cause: 旧快捷键历史使用 `{ records: [...] }`，统一 Apply Plan 历史使用数组；两者曾同时写入 `change_history.json`。
- Safe fix: 旧快捷键继续使用 `change_history.json`；统一事务使用 `apply_plan_history.json`。执行前对所有写入目标建立事务快照，新建文件用 `existedBefore: false` 标记。
- Avoid: 仅因为文件名都叫“变更历史”就复用同一持久化结构；只备份已存在文件而忽略本次新建文件。

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
  5. Menu 分栏容器必须显式声明 `display: grid` 和确定高度；只有 `grid-template-columns` 不会创建 Grid，详情会落到树下并被外层 `overflow: hidden` 裁切。
  6. Hotkey contained 工作区由 `.hotkey-workspace-content` 统一承担纵向滚动，键盘容器只承担局部横向滚动。
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

## PIT-2026-08-01-11: 输入框不能只统一外框而遗漏文字契约

- Area: 共享控件、搜索框、表单占位文字、中文桌面 UI
- Symptom:
  - 输入框高度和边框看似一致，但框内文字显得过小、偏上或与旁边下拉框不协调。
  - 中英文混排的占位文字比正式输入值更薄、更淡，像是使用了另一套字体。
- Root cause:
  - 共享样式只规定 `min-height`、边框和背景，没有统一内边距、字号与行高。
  - 旧页面样式单独把 `.search-input::placeholder` 固定为 12px，覆盖了控件继承关系；浏览器还可能继续降低占位文字透明度。
- Correct fix:
  1. 在 `foundations/controls.css` 为单行输入和选择控件集中规定字体、13px 字号、1.4 行高与水平内边距。
  2. 让 `input::placeholder` 和 `textarea::placeholder` 继承控件排版，并显式设置辅助文字颜色与 `opacity: 1`。
  3. 删除页面级占位字号覆盖，并用样式契约测试防止旧规则回流。
- Guardrail:
  - 业务组件只提供字段语义、标签和示例内容；控件正文与占位文字的排版统一由共享基础层负责。
- Related files:
  - `src/shared/ui/foundations/controls.css`
  - `src/App.css`
  - `tests/controlTypography.test.ts`
- Verification:
  - 搜索框和物理键输入框共用相同排版；契约测试确认旧 12px 占位规则已移除。
- Last seen: 2026-08-01

## PIT-2026-08-01-12: 编辑表单字段必须在计划执行器中有真实语义

- Area: 快捷键编辑、Profile、Apply Plan、来源能力边界
- Symptom:
  - 编辑弹窗可以修改启用状态、备注或方案绑定，确认执行后却没有任何数据变化。
  - 只读参考 env 或 Skill 直接注册项也显示“编辑”，执行计划可能只完成备份便返回成功。
- Root cause:
  - UI 按一个通用表单展示所有字段，没有根据 `bindingSource` 区分可写能力。
  - Profile 计划只写了“将被更新”的占位说明，没有提供真实目标内容；执行器对 `modify_profile` 直接跳过。
  - 计划生成器没有拒绝零个有效写入步骤，导致空计划假成功。
- Wrong attempts:
  - 只修正按钮文案或 Toast，不检查目标文件内容。
  - 在 renderer 中直接调用 Profile 保存接口，绕过计划预览、备份和回滚。
- Correct fix:
  1. env 绑定只展示类型、按键和命令；Profile 绑定才展示启用状态和备注。
  2. 只读来源禁用编辑入口，Core 对不支持来源再次拒绝。
  3. Profile 步骤携带真实 `expectedContent` 与 `writeContent`，执行前检查外部变化。
  4. 计划必须且只能包含可识别写入目标；失败时恢复快照，成功后刷新工作区。
- Guardrail:
  - 新增编辑字段时必须同时提供“来源能力矩阵 + 计划步骤 + 执行分支 + 文件结果断言”，缺一项都不能宣称功能完成。
- Related files:
  - `src/components/HotkeyEditor.tsx`
  - `src/components/hotkeys/HotkeyEditorPanel.tsx`
  - `core/apply/hotkeyEditPlan.ts`
  - `electron/ipc/hotkey.ipc.ts`
  - `tests/hotkeyEditPlan.test.ts`
- Detection:
  - 对 env、当前方案和只读来源分别生成计划，确认步骤数、目标路径和执行后内容。
- Verification:
  - 临时 pcbenv 测试覆盖 env CRLF 修改、外部变化拒绝、Profile 字段更新、撤销、重复键与只读来源拒绝。
- Last seen: 2026-08-01
## PIT-2026-08-04-01: 多 Allegro 版本不能依赖进程环境变量临时定位

- 现象：不同页面或 IPC 分别调用自动检测，多版本安装时可能读写不同的 `pcbenv`。
- 根因：环境模型没有持久化的 `activeEnvironmentId`，`CDSROOT/HOME` 只反映 ATM 进程而不一定反映用户准备管理的 Allegro 版本。
- 规则：所有配置读取与 Apply Plan 必须通过环境注册表解析同一个活动工作区；手动选择目录必须同步更新活动环境。
- 额外风险：多个版本共享同一个 `pcbenv` 时，一次修改会影响全部版本，必须展示共享影响范围。


## PIT-2026-08-06-02: 没有真实发布源时不得伪造应用更新地址

- Area: electron-updater、NSIS 打包、应用内更新
- Symptom: 客户端显示可更新但下载到错误项目或不存在的安装包。
- Cause: 复用其他项目的 GitHub Release 地址，或普通本地打包意外生成 publish 元数据。
- Safe fix: 在 ATM 没有真实 Release 时默认保持未配置；正式构建必须显式注入 HTTPS 目录，并同时发布 latest.yml、NSIS 安装包和 .blockmap。官方仓库建立且资产持续可验证后，运行时默认值只能指向本项目官方地址，禁止复用其他项目。
- Avoid: 复制 PiAgent 更新 URL、在没有真实 Release 时宣称更新可用、默认开启自动下载或自动安装。

## PIT-2026-08-10-02: 检查更新不能在缺少更新源或网络等待时静默返回

- Area: electron-updater、更新源优先级、Renderer 状态反馈、旧安装包升级
- Symptom: 用户点击“检查更新”后按钮短暂禁用或完全没有可见变化；本机 `userData` 中没有 `update-settings.json`。
- Root cause: 发布前本地安装包没有 `package.json.atmUpdateFeedUrl`，`UpdateService.check()` 在 feedUrl 为空时直接返回旧状态；网络检查也没有超时上限。
- Wrong attempts: 只在 UI 修改按钮文字；继续发布同版本导致 semver 判定无更新；把 token 或带查询参数的下载 URL写进客户端。
- Correct fix: 使用 `ATM_UPDATE_URL -> 已保存设置 -> 安装包元数据 -> ATM 官方 Release` 的明确优先级；检查前发布“正在连接”状态，30 秒超时后返回可重试网络错误；提升补丁版本以便旧客户端检测到真正的新版本。
- Guardrail: 更新按钮的每条退出路径都必须产生可见状态；正式 Release 必须同时存在 exe、blockmap、latest.yml，且默认源只能是已验证的本项目 HTTPS 地址。
- Related files: `electron/services/updateService.ts`, `src/components/common/ApplicationUpdatePanel.tsx`, `scripts/publish-github.mjs`, `tests/updateService.test.ts`
- Detection: 删除 `update-settings.json` 并使用无 `atmUpdateFeedUrl` 的打包元数据，检查仍应配置官方源；模拟悬挂请求应在超时后进入 error。
- Verification: `tests/updateService.test.ts`、`npm run verify:update`、正式安装包对 GitHub Latest 的检查/下载/安装 E2E。
- Last seen: 2026-08-10

## PIT-2026-08-08-06: 工作区确认必须固定用户点击的目标

- Area: 统一工作区、React 状态、跨模块应用
- Symptom: 点击非当前工作区的“应用”后，计划按被点击项生成，但确认执行读取 activeWorkspace，导致执行另一套子方案。
- Root cause: 页面只保存 Apply Plan，没有同时保存生成该计划的工作区对象。
- Correct fix: 生成计划成功时固定 `applyTarget`；确认标题、执行器和关闭清理全部引用同一目标。
- Guardrail: 所有“列表项 → 异步预览 → 二次确认”流程必须把目标 ID/对象与预览结果成对保存，禁止在确认阶段重新读取全局 active 状态。
- Verification: 当前工作区为 B 时点击 A，确认标题和 Skill plan 参数必须都属于 A。
- Last seen: 2026-08-08

## PIT-2026-08-08-07: Renderer 返回的 Apply Plan 不能直接作为主进程指令

- Area: Electron IPC、Apply Plan、安全边界
- Symptom: Renderer 可修改序列化计划中的 `targetFile` 或步骤，再交给主进程通用执行器写入。
- Root cause: 主进程把预览载荷同时当作可信执行指令；模块名和环境校验不能证明步骤未被篡改。
- Correct fix: 主进程注册带作用域和过期时间的一次性计划快照；执行时按 ID、作用域、模块和完整序列化内容校验，并执行主进程快照。
- Guardrail: 任何通用文件写入执行器都不能直接信任 Renderer 构造的路径或步骤。
- Related files: `electron/ipc/trustedApplyPlan.ts`, `menu.ipc.ts`, `skill.profile.ipc.ts`, `color.ipc.ts`
- Verification: 篡改目标路径、跨作用域复用和重复消费测试必须被拒绝。
- Last seen: 2026-08-08

## PIT-2026-08-08-08: 持久化函数失败不能被 CRUD 忽略

- Area: 工作区存储、JSON 配置、IPC 成功状态
- Symptom: 创建/重命名返回成功，但重载后记录消失。
- Root cause: `saveWorkspaceStore` 返回 boolean，所有 CRUD 调用方忽略了 false。
- Correct fix: 使用临时文件 + 原子替换；保存失败抛错，由 IPC 转换为中文失败响应。
- Guardrail: 改变持久化状态的函数必须在写入确认后才能返回业务对象；禁止忽略 save 返回值。
- Verification: 把配置根指向普通文件，创建工作区必须抛出“保存工作区失败”。
- Last seen: 2026-08-08

## PIT-2026-08-08-09: 菜单源 JSON、派生 IL 与 Allegro 环境不能混为一体

- Area: 菜单管理、多 Allegro 环境、SKILL 文件编码
- Symptom: ATM 菜单页为空，但 Allegro 仍显示旧菜单；中文“测试”显示为 `²âÊÔ`。
- Root cause:
  - 当前活动环境指向另一个 `pcbenv`，而原菜单在旧环境中。
  - `menu_profile.json` 已为空，但旧 `generated_menu.il` 仍被 bootstrap 加载。
  - 生成器无条件把中文 IL 转为 GBK，目标 Allegro 17.4 会话却按西文代码页解释这些字节。
- Correct fix:
  1. 菜单加载结果必须携带活动环境，并只读提示其他环境中的源方案、备份或旧 IL。
  2. 仅当当前源仓库为空时扫描 ATM 自身备份；恢复必须经过 Apply Plan，且先只恢复源 JSON。
  3. 用户审阅恢复内容后，再通过普通 Apply Plan 以 UTF-8 重建菜单派生 IL；17.2 的启动/路径脚本才使用 GBK。
  4. 在目标 Allegro 会话执行 `atmLoadMenus` 或重启，确认运行时中文显示。
- Guardrail: 禁止用旧 IL 的存在推断源方案完整；禁止自动跨环境复制；禁止不看目标版本就固定使用 GBK 或 UTF-8；恢复和派生文件生成保持两个显式确认步骤。
- Related files: `core/menu/menuManager.ts`, `core/apply/applyPlanEngine.ts`, `electron/ipc/menu.ipc.ts`, `src/pages/MenuPage.tsx`
- Verification: 单元测试覆盖最新非空备份选择、非空当前源不触发恢复、17.2 GBK/17.4 UTF-8 精确字节、失败回滚与撤销；两个目标版本的运行时显示仍需人工确认。
- Last seen: 2026-08-08

## PIT-2026-08-08-10: 同版本的多个 pcbenv 候选不能直接全部进入下拉框

- Area: 多 Allegro 环境、环境注册表、侧栏选择器
- Symptom: 下拉框出现两个 17.2 或两个 17.4，用户只想按 Allegro 版本选择；共享标记还可能指向注册表中已不存在的环境 ID。
- Root cause:
  - 环境发现会为同一安装版本组合安装目录 `SPB_Data\pcbenv` 和用户目录 `C:\Users\...\pcbenv`，却没有在注册表层确定该版本唯一的活动目标。
  - 刷新逻辑按 ID 合并所有历史自动记录，并直接保留旧 `sharedWithIds`，导致已消失环境和错误共享提示长期存在。
- Correct fix:
  1. 注册表读取、保存和刷新都按 `allegroVersion` 归并，每个版本只保留一个环境。
  2. 当前已选环境优先；没有当前选择时，优先版本安装目录旁的 `SPB_Data\pcbenv`。
  3. 归并后再根据规范化 `pcbenvPath` 重建共享关系，并删除缺失路径的自动发现记录。
- Guardrail: 下拉框按版本唯一，但写入安全仍必须保留所选项的 `environmentId + pcbenvPath`；不得仅凭版本号执行 Apply Plan，也不得信任没有当前 peer 的历史共享 ID。
- Related files: `core/environment/environmentRegistry.ts`, `src/components/AllegroEnvironmentSwitcher.tsx`
- Detection: 构造 17.2/17.4 各自的安装/用户两个候选，确认最终只有两个环境；切换当前候选后刷新，确认选择不漂移；注入缺失路径与无效 peer ID 后确认被清理。
- Verification: `tests/environmentSwitcher.test.tsx` 与 `tests/multiEnvironmentCompatibility.test.ts`。
- Last seen: 2026-08-08

## PIT-2026-08-09-01: 选择管理目标不会改变桌面启动的 Allegro HOME

- Area: 多 Allegro 环境、Windows 环境变量、Electron 子进程启动、菜单乱码
- Symptom: ATM 已选择 Allegro 17.2，用户也打开了 17.2 执行文件，但窗口仍显示 17.4 的旧 ATM 菜单和 `²âÊÔ` 乱码。
- Root cause: ATM 的环境选择只控制自身读写目标；桌面快捷方式启动的 Allegro 继续继承 Windows 全局 `HOME/CDSROOT`。本机全局变量指向 17.4，17.2 自己的 `pcbenv` 没有 ATM 派生文件，实际显示内容却来自 17.4 的旧 GBK `generated_menu.il`。
- Wrong attempts: 继续修改 17.2 空目录中的菜单文件；仅按 Allegro 版本号推断实际 `pcbenv`；把 ATM 下拉切换误认为系统环境切换；为了避免误启动而从 UI 移除唯一可达的隔离启动入口，转而让用户使用同样会继承错误 HOME 的桌面快捷方式。
- Correct fix: 由主进程根据已注册环境 ID 启动目标 `allegro.exe`，只为该子进程设置目标 `HOME/CDSROOT`；侧栏检测 Windows HOME 与管理目标不一致并告警，并始终保留显式“按此环境启动”入口。不要修改全局环境变量。
- Guardrail: “管理目标”和“运行进程环境”必须分别表述；任何运行时结论都要核对实际 HOME、执行文件和加载文件三者。Renderer 不得提交可执行路径，IPC 必须从注册表重新解析。多版本支持不能只保留管理目标切换而移除隔离启动入口。
- Related files: `core/environment/allegroLauncher.ts`, `electron/ipc/env.ipc.ts`, `electron/preload.ts`, `src/components/AllegroEnvironmentSwitcher.tsx`
- Detection: 选中 17.2 且全局 HOME 指向 17.4 时必须显示告警；启动规格必须包含 17.2 HOME/CDSROOT 且不改变 `process.env`。
- Verification: 自动化测试覆盖启动规格与 UI 告警；真实 17.2 会话需确认不再加载 17.4 `generated_menu.il`。
- Last seen: 2026-08-11

## PIT-2026-08-09-02: Allegro SKILL 启动文本编码必须绑定目标版本

- Area: Allegro 17.2/17.4、SKILL、`allegro.ilinit`、Apply Plan
- Symptom: 真正隔离启动 17.2 后，Command 窗口把 `01-布局` 显示为 `01-甯冨眬`，随后所有中文目录中的 `.il` 都提示 `can't access file`。
- Root cause: 17.2 Windows 会话按 CP936/GBK 读取启动 SKILL 文本，但现有 `allegro.ilinit` 是 UTF-8；UTF-8 中文字节被当作 GBK 解码。17.4 的已观测行为相反，固定 GBK 会显示为 `²âÊÔ`。
- Wrong attempts: 全版本强制 UTF-8；全版本强制 GBK；把启动脚本编码修复误认为能够补齐 17.2 动态菜单的 Unicode UI 能力；直接覆盖用户 pcbenv 文件。
- Correct fix: 从活动环境的 `allegroVersion` 为脚本选择 17.2=GBK、17.4=UTF-8；读取旧文件时自动识别，Apply Plan 步骤显式携带 `textEncoding`。17.2 动态菜单标签另受 ASCII 限制；JSON、历史和备份清单始终为 UTF-8，备份/回滚按原始字节复制。
- Guardrail: 编码策略必须同时区分目标版本和脚本职责；计划必须锁定环境并经过可信快照、备份和确认。未知版本默认维持 UTF-8 并要求运行时验证。
- Related files: `core/environment/allegroTextEncoding.ts`, `core/apply/applyPlanEngine.ts`, `electron/ipc/menu.ipc.ts`, `electron/ipc/skill.profile.ipc.ts`, `electron/ipc/skill.apply.ipc.ts`
- Detection: 检查原始字节；UTF-8 文件按 GBK 解码能稳定复现“甯冨眬”，GBK “测试”按西文代码页显示能稳定复现 `²âÊÔ`。
- Verification: `tests/allegroTextEncoding.test.ts`、`tests/applyPlanEngine.test.ts` 覆盖版本映射、自动识别、精确字节和 JSON 不转码；真实 17.2/17.4 重启验证仍需人工完成。
- Last seen: 2026-08-11

## PIT-2026-08-11-03: 17.2 动态菜单 API 不支持 Unicode 标签

- Area: Allegro 17.2、菜单 UI、SKILL 文件编码、Apply Plan
- Symptom: 顶层 ASCII 菜单名正常，但中文“器件”显示为 `Æ÷¼þ`，中文命令项全部呈现同类西文乱码。
- Root cause: 17.2 的 SKILL 文件必须按 CP936/GBK 加载，而 `axlUIMenuInsert` 所在 UI 路径并不支持 Unicode；SKILL 字符串可以保存多字节序列，但 UI 逐字节显示。
- Wrong attempts: 所有 `.il` 统一写成 GBK；把整个 `generated_menu.il` 改成 UTF-8；只清除旧菜单而不检查实际 `t_display` 字节；自动化命令没有确认 Command 输出就误认为热重载成功；在普通 `Command >` 直接输入 `load(...)`，导致 `Command not found`。
- Correct fix: `MenuItemConfig.label` 保留中文原名，独立 `compatibilityLabel` 保存用户确认的 ASCII 英文名；预览和 Apply Plan 都按目标版本解析，17.2 缺失/非法时阻断，17.4 忽略兼容名。
- Guardrail: 禁止再尝试 GBK/UTF-8/八进制转码来宣称修复 17.2 中文菜单；普通 `Command >` 热重载必须使用 `skill (load "...")`，并确认 `ATM: menu loaded` 后才算有效运行测试。
- Related files: `core/environment/allegroTextEncoding.ts`, `core/menu/menuManager.ts`, `electron/ipc/menu.ipc.ts`, `docs/user/features/menu-recovery-and-encoding.md`
- Detection: “器件”GBK `C6 F7 BC FE` 显示为 `Æ÷¼þ`；UTF-8 `E5 99 A8 E4 BB B6` 及其八进制等价序列显示为另一组西文乱码，证明 UI 未进行 Unicode 解码。
- Verification: 17.2 S083 实机完成 GBK、UTF-8 文件、UTF-8 八进制三组对照；两个实验均已回滚。产品已实现 ASCII 兼容名字段、Renderer 校验、版本化生成和 GBK IL/UTF-8 JSON 集成测试；最终英文菜单仍需实机会话确认。
- Last seen: 2026-08-11

## PIT-2026-08-11-02: electron-builder 并发发布会拆出两个同名 Draft Release

- Area: GitHub Release、electron-builder、electron-updater、Windows 安装包
- Symptom: Windows 打包成功，但发布脚本等待资产超时；一个 v0.3.3 草稿只有 exe/latest.yml，另一个同名草稿只有 blockmap。
- Root cause: electron-builder 为 exe 与 blockmap 启动并发 GitHub publisher；两个 publisher 同时判断 tag 对应 release 不存在并各自创建草稿，三项资产被拆分。
- Wrong attempts: 只延长轮询超时；直接公开资产不全的草稿；每次发布后手工合并重复草稿。
- Correct fix: electron-builder 使用 `--publish never` 只构建本地产物；脚本用 `gh release create` 创建唯一草稿，再用一次 `gh release upload --clobber` 串行上传 exe、blockmap、latest.yml，资产齐全后公开为 latest。
- Guardrail: 正式发布必须验证唯一 tag、非 draft、三项资产齐全及 `latest.yml` 版本/路径；发布脚本不得把 GitHub Release 创建交给多个并发 publisher。
- Related files: `scripts/publish-github.mjs`, `.github/workflows/package-windows.yml`, `tests/publishScript.test.ts`
- Detection: 发布日志出现两次 `creating GitHub release`；API 返回两个相同 name/tag 的 draft，资产互补。
- Verification: 静态回归测试固定 `--publish never + gh release upload`；下一版本真实 tag 发布确认只生成一个 Release。
- Last seen: 2026-08-11
