# Handoff

## 2026-08-11 菜单页面切换丢失草稿修复

- 根因：普通侧栏页面导航未执行菜单草稿保存，`MenuPage` 卸载后只存在于 React 状态的编辑内容被丢弃。
- 修复：`Layout` 侧栏导航和 `MenuPage` 内部关联跳转复用 `environmentSwitchGuard`；保存失败时保持当前页面。
- 验证：`npx.cmd tsc --noEmit`、`npx.cmd tsc -p tsconfig.electron.json --noEmit`、专项测试均通过。
- 手工验证：打开菜单页编辑一项，点击 Skill/快捷键/系统状态后返回菜单页，确认菜单项仍存在。

## 2026-08-10：应用内检查更新无反应

- 本机证据：`C:\Users\89539\AppData\Roaming\allegro-toolkit-manager` 无 `update-settings.json`，说明运行的是未内置更新源的发布前 0.3.0；旧 `check()` 对空 feed 静默返回。
- GitHub 证据：v0.3.0 已是公开 Latest，安装包、blockmap、latest.yml 三项资产齐全。
- 修复：`OFFICIAL_UPDATE_FEED_URL` 作为最终兜底；检查阶段立即显示连接状态，30 秒超时归类网络错误；版本提升至 0.3.1。
- 验证：更新服务 5 项测试通过；完整 `npm run verify` 全绿，67 个测试文件 / 403 项测试通过。
- 发布：v0.3.1 已公开为 GitHub Latest，exe/blockmap/latest.yml 三项资产齐全，标签指向 `de688a1`；安装包 SHA-256 为 `BE39D38CF367D20C70B81DA9EFDA35D529C2D2D441FEA040837F19160CE3376D`。

## 2026-08-10：菜单切换后草稿消失修复

- 只读核对真实配置：17.4 `menu_profile.json` 的“测试”方案仍包含 6 项；17.2 的两个方案均为空，用户数据未被删除。
- 根因一：Menu Profile CRUD 只替换 `store`，编辑器的 `profile/items/savedItemsJson` 可能继续指向旧方案；根因二：方案/环境切换未先保存草稿。
- 修复：统一状态同步，方案和 Allegro 环境切换前保存，失败阻止切换，窗口卸载提示；菜单 JSON 使用原子保存且 CRUD 检查失败。
- 新增显式跨环境复制：蓝色环境提示可生成可信 Apply Plan，把来源非空菜单复制为当前环境新草稿；来源不写入，目标 IL 需后续另行“审阅并应用”。
- 验证：`npm run verify` 全绿，67 个测试文件 / 401 项测试通过；新版 `release/ATM-Setup-0.3.0-x64.exe` 已生成，SHA-256 `A58A3D61AA3B1ADCE02D424CD76814E7B041ECEB8B76A3648AAF44F8FB0B88B8`。Electron 可见窗口中的复制/切换流程仍需用户安装后确认。

## 2026-08-10：环境控件改为只切换、不启动

- `AllegroEnvironmentSwitcher` 现在先选择目标版本，再点击“切换环境”；提交前仍执行页面级环境切换保护器。
- 左下角控件不再调用 `launchAllegroEnvironment`，不会打开 Allegro，也不会尝试修改 Windows 全局 `HOME/CDSROOT`。
- 已更新多版本环境用户/开发文档、模块图和连接检查表；需重建 Electron 后手动确认切换 17.2/17.4 会刷新到对应管理目标。

## 2026-08-09 追加：17.2 中文 Skill 路径加载失败

- 实机证据：17.2 S083 Command 窗口把 `01-布局`、`03-检查调整` 显示为 `01-甯冨眬`、`03-妫€鏌ヨ皟鏁`，并对 11 个实际存在的 `.il` 报 `can't access file`。当前 `allegro.ilinit` 为无 BOM UTF-8；同字节按 GBK 解码可精确复现截图。
- 修复：新增 `core/environment/allegroTextEncoding.ts`，17.2 及更早写 CP936/GBK，17.4 写 UTF-8；读取现有 `.il`/`allegro.ilinit` 自动识别。统一 Apply Plan 仅给 Allegro 脚本步骤附加编码，JSON 与历史仍为 UTF-8，备份/回滚仍按原始字节。
- 接入：Menu、Skill Profile、旧 Skill Toggle、Vibe Bridge 和 Hotkey 加载上下文均使用版本策略；重新应用 17.2 当前 Skill 方案会备份并转换 `generated_skill_loader.il`、`bootstrap.il` 与 `allegro.ilinit`。
- 验证：`npm run verify` 全绿，66 个测试文件 / 394 项测试通过；安全审计、lint、格式、双端 TypeScript 和生产构建均通过。仍需在用户确认 Apply Plan 后重启真实 17.2 复测。
- 独立问题：`SPMHOD-29` 表示板文件副本由更高版本保存；应在 17.4 使用 File → Export → Downrev Design 另存 17.2 副本，不能靠脚本编码修复。

## 2026-08-09 追加：17.2 仍显示 17.4 乱码菜单

- 实机文件证据：17.2 注册环境自己的 `pcbenv` 下没有 `atm_generated/generated_menu.il`；17.4 的旧文件存在且是 GBK 字节，“测试”解码为 `B2 E2 CA D4`，与截图 `²âÊÔ` 完全一致。
- 系统证据：当前 Windows 用户 `HOME=D:\application\Cadence\Cadence17\Cadence\SPB_Data`、`CDSROOT=...\SPB_17.4`。因此直接启动 17.2 执行文件仍可能读取 17.4 `pcbenv`。
- 修复：新增 `core/environment/allegroLauncher.ts`、`env:launch-workspace`、preload/window 类型和侧栏“按此环境启动”；新进程使用所选环境自己的 `HOME/CDSROOT`，不修改全局环境变量。HOME 不一致时侧栏明确告警。
- 验证：`npm run verify` 全绿；65 个测试文件 / 390 项测试通过，安全审计、lint、格式、双端 TypeScript 和生产构建均通过。
- 待确认：重新构建并重启 ATM，从侧栏选择 17.2 后点击“按此环境启动”，确认新 17.2 会话不再加载 17.4 旧菜单。菜单 UTF-8 重建仍需走原菜单 Apply Plan，不得直接覆盖用户文件。

## 2026-08-08 追加：菜单拖动有影子但不换位修复

- 根因是递归行各自保存拖动 state，且目标行在 Chromium protected-mode `dragover` 中读不到 DataTransfer payload；向下相邻拖动的旧插入索引也可能得到原顺序。
- `MenuTree` 顶层现共享拖动源、父级和目标；同级目标显示强调线，drop 后调用页面现有 `onReorder`。
- `reorderMenuItem` 使用删除前目标索引，向下拖动落到目标之后、向上拖动落到目标之前。
- 回归测试覆盖 protected-mode 空 payload、目标反馈、相邻向下换位和跨父级拒绝；完整 `npm run verify` 已通过（64 个测试文件 / 387 项测试），Electron 可见窗口仍需重启应用后复核。

## 2026-08-08 追加：菜单详情裁切与环境重名修复

- 菜单分栏补回 `display:grid + height:100%`，树和属性面板各自滚动，原先落到树下方的属性区及删除按钮恢复可达。
- 侧栏环境选择器启动时刷新；注册表读取/保存/刷新均按版本归并，每个 Allegro 版本只显示一个选项。当前选择优先，否则优先该版本安装目录旁的 `SPB_Data\pcbenv`。
- 环境注册表不再保留缺失路径的自动发现记录，并按当前 `pcbenvPath` 重建共享 ID。
- 完整 `npm run verify` 已通过：64 个测试文件 / 385 项测试，安全审计、lint、格式、双端 TypeScript 和生产构建均通过；Electron 可见窗口仍需重启应用后复核。

## 2026-08-08 追加：统一工作区缺陷修复与 Apply Plan 信任边界

- 修复从非当前工作区卡片应用时误用 activeWorkspace 的问题；页面固定 `applyTarget`，并在首个写入前重新请求 `workspace:apply-plan` 校验环境与方案状态。
- 新增工作区“配置/复制”入口和 `workspace:binding-options` / `workspace:update` 完整链；新建后自动进入环境与四类方案绑定。
- 环境锁在当前环境为空时也会阻止执行；失败步骤不再计入完成数量。
- `workspaces.json` 改为临时文件原子替换，保存失败抛错；默认工作区和当前使用中的工作区不可删除。
- 新增 `trustedApplyPlan.ts`：Menu、Skill Profile、Vibe Bridge 计划只能执行主进程生成、未篡改、同作用域且未消费的快照。
- 配色页桥接手动命令使用动态 `serverFile`，移除开发机用户名与重复捕获按钮。
- 验证：`npm run verify` 全绿；63 个测试文件 / 380 项测试通过；生产构建通过。
- 尚未执行：真实 Allegro 写入、Electron 可见窗口手工巡检和安装包重打包，避免在自动修复流程中影响用户环境。

## 最新进展（2026-08-08）：v0.3.0 Beta 收口

- 配色方案：单层自定义颜色（Hex + 取色器，安全索引分配）、应用预览弹窗（目标板叠层/角色/最终颜色/调色板变更/可见性）、应用前自动快照 + 一键撤销。
- 备份恢复：.atmbak 单文件备份（pcbenv 级 + 应用级 + 界面偏好）、分区恢复、恢复前现场备份、写入失败自动回滚。
- 窗口状态：大小/位置/最大化持久化与显示器可见性校验。
- 运行时基础设施：IPC 通道注册表（app:getRuntimeInfo 自检准确）、发布脚本 gh 检查、多版本 SPB_Data 去重。
- 提交：master 上 9 个主题提交（配色/备份/运行时/文档/测试/style），工作区干净；60 文件 / 353 测试全绿；npm run verify 全绿；Windows 解包版 release/win-unpacked/ATM.exe 已生成。
- 生产巡检：6 个路由页面渲染、asar 内容、备份页降级提示、配色预览/撤销完整流程均通过浏览器验证。


## 2026-08-08 追加：发布产物与阻塞点

- NSIS 安装包已生成：release/ATM-Setup-0.2.0-x64.exe（87,295,327 bytes）+ blockmap（electron-builder 打包链路完整）。
- Electron 实机巡检已通过 CDP 完成（preload 154 API / 113 条快捷键 / 配色 ceshi 方案 / 备份页）。
- 阻塞点（需用户桌面会话）：Allegro 已打开 A10_pcb_4DDR3_MID.brd，但 Vibe Bridge 未加载。请在 Allegro 命令窗执行：skill load("C:/Users/89539/.codex/skills/allegro-vibe-bridge/vibe_server.il")，随后可做真实捕获/自定义颜色/应用/撤销/重捕获验证。
- 安装包安装与升级 E2E、GitHub Release 发布（v0.3.0 Beta）也需用户确认执行。

## 2026-08-08 追加：统一工作区 M1-M3 完成

- M1 数据模型与 CRUD：core/workspace/workspaceManager.ts + workspace.ipc.ts 六通道，默认工作区删除保护。
- M2 统一预览：core/workspace/buildWorkspacePreview.ts + workspace:preview，环境 + 四类子方案存在性/摘要。
- M3 规划层：core/workspace/planWorkspaceApply.ts，Skill→菜单→快捷键→配色 顺序 + 环境锁 + 缺失方案跳过。
- 测试：365 全绿（新增 11 个工作区测试）。版本已提升 0.3.0，NSIS 安装包 ATM-Setup-0.3.0-x64.exe 就绪。
- 剩余：M3 实际执行链 + M4 页面入口（v0.3.0 后）；真实 Allegro 验证（待用户加载 bridge）。
## 待用户桌面会话手动验证

1. Electron 窗口级实机巡检（当前自动化会话无法创建窗口）。
2. 真实 Allegro：捕获 → 自定义单层颜色 → 应用（预览）→ 撤销 → 重新捕获。
3. 备份恢复 E2E：创建 .atmbak → 改动配置 → 差异预览 → 分区恢复 → 真实安装包。
4. 之后进入"统一工作区方案"（Allegro 版本/pcbenv + 快捷键/Skill/菜单/配色 一次选择统一应用）。


## 当前状态

- 四个侧栏入口已完成简化：快捷键、Skill、菜单、系统状态；环境详情路由保留兼容。
- 第二轮 UI 排查与简化已完成：字号、顶部层级、键盘可读性、渐进披露、单一主操作和异常优先状态均已收口。
- 应用壳层、设计令牌、页头、状态条、页面状态与 Apply Plan 对话框已集中到 `src/shared/ui/`。
- 五个业务页面已按路由动态加载；侧栏、壳层和统一加载态保持同步可用。
- 侧栏悬停/键盘聚焦会预加载目标页面；页面 chunk 失败时保留壳层并提供重载/返回入口。
- 核心确认框、Apply Plan、菜单预览已统一 Tab 循环、Escape 与关闭后焦点恢复。
- 新增/编辑快捷键、Skill 信息、Skill 删除影响、菜单命令选择已迁移到统一 BusinessDialog；表单标签、尺寸、密度、风险说明和焦点入口一致。
- Hotkey、Skill、Menu 写入仍经过原 Apply Plan、备份、回滚和历史记录链路。
- 快捷键编辑核心执行器已补齐备份、失败回滚与历史；Skill 旧计划入口已转入统一事务引擎，物理删除可撤销。
- 统一计划历史使用 `apply_plan_history.json`，旧快捷键历史继续使用 `change_history.json`，避免不同结构互相覆盖。
- Windows CI、生产依赖审计、Lint/格式/类型/测试/构建总门禁与 NSIS 打包流程已经接入。
- Git 已初始化；重置前基线提交为 `c95a222`。

## 本次主要变化

- 用 216px 分组侧栏替换旧壳层，不再使用 JavaScript 整页缩放。
- 快捷键页改为紧凑页签和固定密度键盘工作区；数据装载抽到 service。
- 快捷键拆分为“键位 / 列表 / 冲突”三个任务视图；键位页只显示全宽键盘，搜索表格和选中详情进入独立列表页，导入导出与历史进入工作区工具。
- Skill 默认栏只保留搜索和筛选；详情为三类标签，命令与 Skill 操作使用上下文菜单。
- Menu 以菜单树为唯一常驻工作台；命令清单/引用检查从工具进入，添加统一为单一入口，主按钮由草稿状态驱动。
- Skill 和 Menu 共用 Apply Plan 对话框；Menu 使用树/属性稳定分栏。
- 概览改为健康度、核心入口和关键文件状态；环境页改为来源优先级、活动路径、权限和环境变量。
- 删除 `HotkeyPage.tsx`、MinimalSurface、CoreWorkspaceHero、ProfileSelector、旧 ApplyPlanPreview 和响应式缩放实现。
- `App.css` 删除旧 Hero、Marvis、MinimalSurface 样式；新基础位于 `src/shared/ui/foundations/`。
- 快捷键页删除基于 ResizeObserver 的整体缩放，键盘文字保持 12px，并在空间不足时由键盘容器内部滚动。
- 快捷键 contained 工作区由内容区承担纵向滚动，编辑和冲突页在 1220×820 下可完整到达底部；键盘只承担局部横向滚动。
- 键盘上部键位悬浮卡按键盘相对位置向下展开，不再遮挡状态条和页签。
- ProfileBar 不再重复显示方案 ID/应用状态；空方案显示“暂无方案”并禁用应用。
- 快捷键装载失败时状态条显示“加载失败 / 尚未检查”，页面使用红色错误提示，不再误报“0 个问题”。
- Skill 和 Menu 的关键工作区使用连续 `min-height: 0` 滚动链；深层可见 Emoji 已替换为 Lucide 图标或明确文字。
- 新增统一用户错误转换，浏览器或桌面桥接缺失时显示中文可恢复提示。
- `App.tsx` 使用统一 `Suspense` 边界拆分 Dashboard、Environment、Hotkey、Skill、Menu 页面包；Vite 入口 JS 从 556.55kB 降至 244.78kB。
- 路由加载器集中到 `routePageLoaders.ts`，导航预加载与 `React.lazy()` 共用同一来源；错误边界按一级工作区分组，快捷键子路由切换不重建父页面。
- Hotkey 与 Skill 的错误状态增加就地重试；核心共享对话框接入 `useDialogFocus`。
- `BusinessDialog` 统一深层弹窗壳层，五个高频弹窗已清除旧 `modal-*` 结构和布局内联样式。
- 变更历史、速查表导出和 Env 来源管理也已迁移到 `BusinessDialog`。
- 快捷键列表使用独立 `/hotkeys/list` 子路由；宽窗口为表格/详情双栏，窄窗口堆叠并由工作区内部滚动。
- 快捷键顶部已压缩：移除重复 eyebrow，方案与状态在宽窗口共用一行，子页标题/说明/主操作改为单行工具栏；1280×720 浏览器检查中列表主体从 y=283 开始，顶部无横向溢出。
- 输入框文字规范已下沉到 `foundations/controls.css`：搜索、文本、方案和下拉控件统一 13px 排版与垂直对齐，占位文字不再被旧 `App.css` 单独缩成 12px。
- 新增/编辑快捷键已接入命令辅助：英文、中文和用途关键词可搜索，物理键 M 会优先提示 `move（移动）`，支持方向键与 Enter 填入。
- 快捷键编辑已消除假成功：env 行与 Profile 绑定具有真实写入内容，重复键、只读来源、零步骤和外部文件变化都会被拒绝；Profile 的启用状态与备注可保存并撤销。

## 验证

- 前端 TypeScript：通过
- Electron TypeScript：通过
- 全量测试：45 个测试文件 / 238 项测试全部通过
- 临时 pcbenv：快捷键、Skill、菜单写入/备份/失败回滚/撤销通过
- 发布门禁：`npm run verify` 通过
- Windows 打包：解包应用启动成功；`ATM-Setup-0.1.0-x64.exe` 生成成功
- 最终安装包：86,894,930 bytes；SHA-256 `6572F567D52A633E164221EDE638059DD8324A0AEC1FE0DD6C0D96F77D126008`
- 打包版 UI：窗口标题、四个侧栏入口、113 条真实快捷键、env 已连接和完整键盘可访问性树验证通过；品牌图标从 `ATM.exe` 提取检查正常
- 真实 pcbenv 只读冒烟：解析 123 行 / 41 条绑定 / 0 警告；`env` 与 `allegro.ilinit` 检查前后 SHA-256 不变
- Renderer 生产构建：通过；入口 246.60kB，快捷键页面包约 163.70kB，无 500kB chunk 告警
- 浏览器：1368×856 下列表页为表格/详情双栏且无页面级横向溢出；1024×768 下自动堆叠，并由工作区内部纵向滚动承接完整内容。键位页仅保留键盘，三个任务页签状态正确。
- 路由加载：本地生产预览依次打开快捷键、Skill、菜单、系统状态、环境页，均出现正确一级标题，未出现动态模块加载错误
- 恢复入口：生产预览在无 Electron 桥接场景下显示中文错误和“重新加载”；路由边界、预加载、对话框键盘行为由 renderer 测试覆盖
- 控件排版：`controlTypography.test.ts` 与快捷键工作区组件测试通过，覆盖输入框字号、行高、内边距和占位文字继承规则
- 快捷键辅助/编辑：命令排序、中文搜索、M→move、键盘选择、重复键、env CRLF、Profile 更新、外部变化回滚、撤销和只读来源测试通过
- Electron 实机：生产资源服务、preload 注入、IPC 环境读取与 113 条真实快捷键数据加载成功；控制台无页面运行错误
- Allegro 会话只读冒烟：在 `unnamed.brd` 临时副本中加载 Vibe Bridge，返回程序 `allegro`、版本 `17.4-2019 S039`、设计 dbid `000001EA26BE8EC0`，并确认 `1 design unit = 1 mil = 0.0254 mm`；测试前后源文件与副本 SHA-256 均为 `297EF621C30B4003FBA0B86624BACBCE4BA0602CFD378FD0C11A516451E01043`。桥接已停止，Allegro 已关闭，临时副本与脚本已清理。

## 已知非阻断项

- Structure OS CLI 未安装，本次继续采用文件化治理。
- Env 导入、方案导入预览和快捷键删除确认仍使用旧壳层；其中 Env 导入文件较大，应在独立重构批次拆分状态机和视图，避免与发布修复混改。
- 安装包已使用 `build/icon.svg` 品牌图标，但发布者仍为通用名称且未配置代码签名；公开分发前必须补齐真实发布者信息和签名证书。
- 参考截图中的复杂 Allegro 宏仍为 provisional；必须在目标 Allegro 版本的 Command 窗口逐条验证后，才能进入可信模板库。
- 菜单丢失/乱码修复已补齐：当前环境无数据时提示其他环境，源 JSON 为空时可从 ATM 备份生成恢复计划，`generated_menu.il` 改为 UTF-8。尚未直接修改用户 pcbenv；需在 Allegro 17.4 中恢复、重新应用并执行 `atmLoadMenus` 做运行时确认。
- 2026-08-04：新增多 Allegro 环境注册表与全局选择器；快捷键/Skill/菜单统一解析活动环境，Apply Plan 锁定 environmentId/pcbenvPath 并拒绝环境漂移。
- 快捷键方案支持跨版本兼容性预检与目标环境副本；Skill、菜单方案已记录来源环境和 Allegro 版本，复杂运行时兼容仍需目标版本实机验证。
- 环境页可通过 Vibe Bridge 调用官方 `axlVersion` 做只读版本核对；2026-08-04 当前外部 Bridge 探测超时，因此没有写入任何伪造的 runtime_pass。
