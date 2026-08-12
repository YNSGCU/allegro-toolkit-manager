# DRC 设计问题报告可视化

> 状态：M1–M6 已完成（解析 / 存储 / IPC / 页面 / 导出 / Bridge 在线抓取），M7 收尾中
> 更新：2026-08-12

## 目标

把 Allegro DRC 报告从「纯文本文件」变成可分组统计、可跟踪状态、可过滤导出的看板。
工程师导入或在线抓取 DRC 报告后，按层 / 网络 / 规则 / 类型四个维度快速定位问题，
对每条问题标记「未处理 / 已解决 / 已忽略」并跨会话持久保留。

## 范围

**做**

- `.rpt` 文本报告解析（多版本容错）
- Extracta CSV 报告解析
- Vibe Bridge 在线抓取（只读 SKILL 查询）
- 归一化数据模型 + 聚合统计
- 报告本地持久化（原始文件 + 解析结果 + 状态标注）
- DRC 看板页面（列表、详情、统计、筛选、状态）
- 过滤后导出 Markdown / HTML / CSV

**不做**

- 不运行 DRC 检查本身（那是 Allegro 的能力）
- 不修改设计数据库、不写 Allegro（全程只读）
- 不做 Gerber / 制造输出管理
- 不做云端同步

## 关键设计：双数据源通道

DRC 报告**没有统一格式**，随 Allegro 版本和导出设置变化，这是本功能最大的技术风险。
因此采用双通道，页面无感知：

### 通道 A：文件解析（离线）

- 用户从 Allegro 导出 Design Rules Check Report（.rpt）或 Extracta CSV，在 ATM 导入。
- 无会话依赖，可归档、可跨电脑分享。
- 解析器必须做多版本容错（大小写、空格、缺字段、多行描述、中英文混合、未知 section）。

### 通道 B：Vibe Bridge 在线抓取（实时）

- 复用现有桥接设施，在 Allegro 会话执行只读 SKILL：遍历 `axlDBGetDesign()->drcs`，
  提取 rule / type / actual / expected / layer / net / xy / waived / fixed。
- 结构化、准确、实时，完全绕开文本解析。
- 依赖会话 + Bridge 已加载；需要条数上限、超时和错误响应容错。

两通道输出统一 `DrcViolation[]`，前端无感知差异。

## 数据模型（`src/types/drc.ts`）

```ts
type DrcSeverity = 'error' | 'warning';
type DrcStatus = 'unresolved' | 'resolved' | 'ignored'; // ATM 侧工作流状态，不写 Allegro
type DrcSourceType = 'file' | 'bridge';
type DrcFileFormat = 'rpt-text' | 'extracta-csv' | 'unknown';

interface DrcViolation {
  id: string;            // 稳定 id：rule+layer+net+xy 的 hash
  rule: string;          // 规则码，如 SPMHCS-1
  description: string;
  severity: DrcSeverity;
  category?: string;     // Class，如 Soldermask
  constraintType?: string; // Constraint，如 SolderMask
  actual?: string;
  expected?: string;
  layer?: string;
  net?: string;
  component?: string;
  pin?: string;
  location?: { x: number; y: number; units?: string };
  count: number;         // 同规则聚合数量
  waived: boolean;       // 展示用，读自 Allegro，不可改
  fixed: boolean;
  sourceLine: number;    // 原始文件行号，点击回看原文
  raw: string;
  status: DrcStatus;
}

interface DrcSummary {
  total: number;
  errors: number;
  warnings: number;
  resolved: number;
  ignored: number;
  byType: DrcGroupCount[];   // 按约束类型 / Class
  byLayer: DrcGroupCount[];
  byNet: DrcGroupCount[];
  byRule: DrcGroupCount[];
}

interface DrcReport {
  id: string;
  name: string;
  sourceType: DrcSourceType;
  format?: DrcFileFormat;
  designName?: string;
  allegroVersion?: string;
  units?: string;
  exportedAt?: string;
  importedAt: string;
  rawHash: string;       // SHA-256，导入去重
  parseWarnings: string[];
  summary: DrcSummary;   // core 侧算好，列表页不加载全量违规
  violations: DrcViolation[];
}
```

`summary` 在 core 侧预计算并持久化，列表页只读 summary，详情页按需分页拉 violations，
万级数据下不卡。

## 核心模块（`core/drc/`，纯 TS 可测）

| 文件 | 职责 |
|---|---|
| `drcReportParser.ts` | `detectFormat()` 识别 rpt-text / extracta-csv / unknown；`parseRptText()` 按 section 切分（头部 / Summary / 违规条目段），支持 `#N ERROR(CODE-x): desc` 行 + 属性行；`parseExtractaCsv()` 元数据头 + 表头探测 + 列映射。容错：大小写、空格、缺字段、多行描述、中英文 key、未知 section 跳过并记 warning |
| `drcNormalizer.ts` | 规则码大写、层名大小写归一、去重合并（count）、坐标解析、`makeViolationId()` |
| `drcStats.ts` | `buildSummary()` 聚合四维分组 |
| `drcStore.ts` | （M2）持久化到 `%APPDATA%/AllegroToolkitManager/drc/`，原子写入、SHA-256 去重 |
| `drcBridge.ts` | （M6）生成只读 SKILL 查询脚本 + 响应解析；只读红线断言 |

**只读红线**：`drcBridge.ts` 生成的 SKILL 只调用读取 API，测试断言脚本文本不含写 API 关键字。

## IPC 链路（M2，`electron/ipc/drc.ipc.ts`）

严格走现有 6 层模式（core → ipc → preload → window.d.ts → React）：

- `drc:open-dialog` — 文件选择（.rpt/.csv/.txt）
- `drc:parse-file` — 读取 + 编码探测（复用 `allegroTextEncoding`）+ 解析预览（未落盘）
- `drc:import-report` — 确认导入：SHA-256 去重 → 原子落盘
- `drc:list-reports` — 摘要列表（不含 violations）
- `drc:get-report` — 完整报告（分页）
- `drc:delete-report`
- `drc:update-status` — 单条/批量标记状态
- `drc:bridge-probe` — Bridge 连接探测（复用版本核对逻辑）
- `drc:bridge-fetch` — 在线抓取；执行前校验 environmentId 与当前环境锁一致
- `drc:export-report` — 按筛选结果导出

## 前端页面（M3-M5，`src/pages/DrcPage.tsx`）

侧栏「核心工作区」新增 **DRC 看板** 入口，遵守 V5.6 统一顶部结构：

```
页面标题
GlobalStatusBar（报告数 / 待处理 / 错误 / Bridge 连接状态）
主操作：导入报告（蓝） + 在线抓取（绿） + 更多操作（导出、删除、清空）
┌──────────────┬────────────────────────────────┐
│ 报告列表（左栏） │ 摘要卡：总数/错误/警告/已解决/已忽略   │
│ 最近导入，可切换 │ 分组 Tab：按层｜按网络｜按规则｜按类型   │
│              │ （条形占比 + 点击下钻）           │
│              │ 违规明细表（分页/虚拟滚动）          │
│              │ 筛选栏：关键词/层/网络/规则/严重度/状态 │
└──────────────┴────────────────────────────────┘
```

组件：`DrcReportList`、`DrcSummaryCards`、`DrcGroupTabs`、`DrcViolationTable`、
`DrcFilterBar`、`DrcImportDialog`、`DrcBridgeDialog`、`DrcExportDialog`。
复用 `BusinessDialog`、`GlobalStatusBar`、`Toast`、`ConfirmDialog`、`PageState`、`RawLineView`。
页面走 `React.lazy` + `routePageLoaders` 懒加载。

## 测试计划

**fixture（`test-fixtures/drc/`）**

- `drc.basic.rpt` — 标准英文报告（头部 + Summary + 4 条违规）
- `drc.chinese.rpt` — 中文字段名与描述
- `drc.extracta.csv` — Extracta CSV（元数据 + 表头 + 数据行）
- `drc.weird.rpt` — 缺字段、多行描述、大小写不统一、未知 section
- `drc.bridge.response.log` — （M6）SUCCESS + 结构化 DRC 数据

**core 单测（M1，约 40-60 项）**：格式识别、各 fixture 解析、空文件/未知格式容错、
normalizer 去重与规范化、stats 聚合正确性。

**组件测试（M3-M4，约 10-15 项）**：DrcPage 渲染、筛选、状态标记、分组切换、空状态、错误状态。

## 里程碑

| 阶段 | 内容 | 验证标准 |
|---|---|---|
| M1 数据基础 | drc 类型 + 解析器（rpt/csv）+ fixture + 单测 | 全部 fixture 解析通过，容错用例通过 |
| M2 存储与 IPC | drcStore + drc.ipc + preload/window.d.ts | 导入/列表/详情/删除通道单测通过 |
| M3 页面骨架 | /drc 路由 + 侧栏 + 列表 + 详情 + 原文回看 | 导入真实样本可浏览 |
| M4 看板与跟踪 | 统计聚合 UI + 明细表 + 筛选 + 状态标记/批量 | 分组下钻、状态持久化验证 |
| M5 导出 | Markdown/HTML/CSV | 导出内容与筛选结果一致 |
| M6 在线抓取 | Bridge 探测 + 抓取 + 环境锁 + 容错 | 17.4 会话抓取成功；版本不匹配被拒 |
| M7 收尾 | 用户/开发文档 + `npm run verify` 全绿 + 版本发布 | 门禁通过 |

## 风险与边界

1. **格式不标准是最大风险**：双通道兜底；当前无真实样本，先用模拟 fixture 开发，
   拿到真实 `.rpt`（17.2 / 17.4 各一）后回归校准。
2. **大板子数据量**：聚合在 core 侧预计算，详情分页/虚拟滚动。
3. **编码**：文件读取复用现有 GBK/UTF-8 探测，中文报告不乱码。
4. **信任边界**：状态标注只存 ATM 的 `drc/` 目录，永不写 Allegro；`waived` 仅展示。
5. **Bridge 降级**：未加载或版本不匹配时明确提示，功能降级为文件导入。

## Ownership

- Renderer：`src/pages/DrcPage.tsx` + `src/components/drc/`
- 类型：`src/types/drc.ts`
- 解析/归一化/统计：`core/drc/`
- 存储：`core/drc/drcStore.ts`
- IPC：`electron/ipc/drc.ipc.ts`
- Bridge：`core/drc/drcBridge.ts`
