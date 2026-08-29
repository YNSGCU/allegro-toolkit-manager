# 跨版本方案同步（17.2 ↔ 17.4 快捷键 / Skill / 菜单）设计

> 状态：M0–M4 已实现（2026-08-29，含 20+ 项测试）；M5 真机验证待办
> 更新：2026-08-29

## 1. 背景与目标

用户在 17.2 与 17.4 两套独立 Allegro 环境（各自 pcbenv 目录）下维护快捷键 / Skill /
菜单方案。日常诉求是：

1. 大部分命令两个版本通用——改一处，另一版本自动跟上（**公共部分同步**）；
2. 少部分功能只有高版本可用（17.4 独有的 Skill 或内置命令）——同步到 17.2 会导致
   命令不可识别甚至报错，必须**按版本隔离**；
3. 隔离不能靠手工逐条维护，也不能靠“整份复制后再删”，要可预览、可追溯、可回滚。

目标：以「目标环境命令可用性」为边界，提供**跨版本方案同步**功能——通用项自动对齐，
版本特有项默认跳过并给出原因，跳过规则可记忆、可覆盖；所有写入仍走既有
Apply Plan（SHA256 备份 + 变更历史 + 回滚）。

## 2. 现状盘点

### 已有能力（可直接复用）

| 能力 | 位置 | 用途 |
|---|---|---|
| 快捷方案 CRUD + 绑定导出 | `core/profile/hotkeyProfile.ts` | 源/目标快捷键方案 |
| Skill 方案 CRUD + diff | `core/skill/skillProfileManager.ts`（`computeSkillProfileDiff`） | 源/目标 Skill 方案 |
| 菜单方案 CRUD + IL | `core/menu/menuManager.ts` | 源/目标菜单方案 |
| 内置命令表 + 命令分类 | `core/validator/commandClassifier.ts`（`ALLEGRO_BUILTIN_COMMANDS`、`classifySourceV2`） | 命令可用性判定 |
| Skill 扫描（入口命令/axlCmdRegister） | `core/skill/scanSkill.ts`、`enhancedScan.ts` | 目标环境命令集 |
| 工作区引用一致性校验 | `core/workspace/workspaceReferenceCheck.ts`（V6.3） | 命令 ↔ 提供者匹配逻辑（反向复用） |
| 跨环境迁移/预检 | `menu-profile-transfer`、`skill-profile-migration`、`targetCompatibility` / `testedAllegroVersions` | 写入兼容元数据 |
| 导入重绑（名称相似度） | `core/workspace/workspaceImportExport.ts`（V6.3） | 两个环境方案 ID 不同时的候选匹配 |
| Apply Plan / 备份 / 撤销 | `core/apply/`、`core/backup/`、`core/changeHistory/` | 写入链路 |

### 现状痛点

- 方案是**整体快照**：没有“基座 + 版本增量”的叠加模型，整份复制会把高版本命令带过去；
- 手工同步两个方案：逐条比对容易漏，也容易误删目标方案里独有的绑定；
- 当前环境中 17.2 / 17.4 的 `pcbenvPath` 在环境注册表里指向同一目录
  （`D:\application\Cadence\Cadence17_2\...\SPB_Data\pcbenv`）：若两版本实际共用目录，
  同步会互相覆盖；若实际独立，说明注册表需要为用户修正。这是本功能的前置条件。

## 3. 设计原则

1. 同步是**可预览、可确认**的操作：先出差异清单，再生成 Apply Plan；
2. **命令级过滤**由目标环境命令集自动判定，不依赖人工黑名单；
3. 同步默认落到目标环境的**新方案**（不覆盖现有），用户可显式选择覆盖式同步；
4. 低版本 → 高版本：默认全量同步（仍做存在性校验）；
   高版本 → 低版本：默认跳过“目标环境无提供者”的条目，并记录原因；
5. 跳过规则可按“命令对”记忆（总是同步 / 总是跳过 / 每次询问），避免重复确认；
6. 所有写入经过 Apply Plan；生成目标方案前不触碰任何现有文件；
7. 不解决“命令存在但行为有版本差异”的问题：本功能只保证命令可识别、Skill 可加载，
   跨版本行为差异仍沿用现有兼容预检提示。

## 4. 数据模型

### 4.1 同步规则存储（应用级）

`%APPDATA%/AllegroToolkitManager/sync_rules.json`

```ts
interface SyncRuleKey {
  /** 源命令（归一化） */
  command: string;
  /** 目标环境的 Allegro 版本，如 "17.2" / "17.4" */
  targetVersion: string;
}

type SyncRuleDecision = 'always_sync' | 'always_skip' | 'ask';

interface CrossVersionSyncRule {
  command: string;
  targetVersion: string;
  decision: SyncRuleDecision;
  /** 用户手动设置的原因备注（可选） */
  note?: string;
  updatedAt: string;
}

interface SyncRuleStore {
  version: '1.0';
  rules: CrossVersionSyncRule[];
  updatedAt: string;
}
```

默认规则（不落盘即默认行为）：目标环境命令集**有**提供者 → `always_sync`；
**无**提供者 → `always_skip`（原因：仅源版本可用）。用户可把任意条目改为 `ask`。

### 4.2 同步计划（纯函数产物，不落盘）

```ts
type SyncItemKind = 'hotkey' | 'skill' | 'menu';
type SyncItemDecision =
  | 'sync'      // 目标环境有提供者，同步
  | 'skip_ver'  // 版本特有：目标环境无提供者，默认跳过
  | 'skip_unknown' // 两边都不认识，警告并跳过
  | 'keep_target'  // 目标独有：保留（默认不删除）
  | 'delete'    // 用户勾选“删除使完全一致”时才出现

interface CrossVersionSyncItem {
  kind: SyncItemKind;
  ref: string;          // key（快捷键）、skillId（Skill）、path.join(' > ')（菜单）
  command: string;      // 命令原文（菜单/快捷键）；Skill 项为该 Skill 入口命令示例
  decision: SyncItemDecision;
  reason?: string;      // “仅 17.4 Skill drc_helper.il 提供”等
  sourceValue: unknown; // 源方案的该条目（用于生成目标方案）
  targetValue?: unknown;// 目标方案现有条目（对比展示）
}

interface CrossVersionSyncPlan {
  source: { environmentId: string; version: string; pcbenvPath: string };
  target: { environmentId: string; version: string; pcbenvPath: string };
  items: CrossVersionSyncItem[];
  stats: Record<SyncItemDecision, number>;
  blocked: boolean;
  blockedReason?: string; // 两环境目录相同 / 目标环境无 Skill 扫描结果等
}
```

## 5. 同步规则与命令分类

### 5.1 目标环境命令集

对目标环境执行一次**命令扫描**（复用 `scanAllSkills` + 入口命令）得到：

```ts
interface CommandAvailability {
  /** 归一化命令名 → 提供者信息 */
  providedBy: Map<string, Array<{ scope: 'builtin' | 'skill'; skillId?: string; skillName?: string }>>;
  /** 扫描失败的 Skill 文件（解析错误视为“不可用”，给出原因） */
  scanWarnings: string[];
}
```

判定顺序（复用 `workspaceReferenceCheck` 的匹配逻辑，提取为公共函数）：
1. 命令基础名（`extractBaseCommand`）命中 `ALLEGRO_BUILTIN_COMMANDS` → 可用；
2. 命中目标环境某个 Skill 的入口命令 / `axlCmdRegister`（含公司/用户/ATM 三层）→ 可用；
3. 都不命中 → 目标环境无提供者。

### 5.2 条目分类（以 17.4 → 17.2 为例）

| 类 | 条件 | 默认决策 | 原因展示 |
|---|---|---|---|
| A 通用 | 源命令 ∈ 目标命令集 | 同步 | — |
| B 版本特有 | 源命令 ∈ 源命令集，∉ 目标命令集 | 跳过 | “仅 17.4 的 Skill「xxx」提供” / “仅 17.4 内置命令” |
| C 未知 | 两边命令集都没有 | 跳过（警告） | “两边都未识别，请确认” |
| D 目标独有 | 目标有、源没有（key / skillId / 菜单 path 存在性对比） | 保留 | “目标独有，不同步删除” |
| E 手动强制 | B/C 被用户改为勾选 | 同步（用户确认） | “用户强制同步” |

反向（17.2 → 17.4）同一算法：通常 B 类极少（低版本命令高版本大多兼容），但
`ask` 规则照常生效。

### 5.3 各方案粒度的映射

**快捷键（HotkeyProfile）**

按 `key`（含 type funckey/alias）对齐：源方案的 key → 目标方案同名 key。
- 命令命中 A 或 E：替换/新增目标 key 的命令；
- B/C：跳过该 key（保留目标原值或空缺）；
- D：默认保留目标独有 key。
- 同一命令名可对应多 key（不同功能键），逐 key 独立判定。

**Skill（SkillProfile）**

按 `skillId` 对齐（若两环境 Skill 文件路径不同导致 ID 不同，先按
`scoreNameSimilarity`（文件名/路径）匹配，匹配结果进入待确认清单）。
- 目标环境能找到对应 Skill 文件：
  - 同步 `enabled` / `loadEnabled`；
  - `loadOrder` 沿用源顺序，但只保留同步成功的条目；
  - 若 Skill 菜单/快捷键引用了该 Skill 的命令，走命令级规则。
- 目标环境找不到该 Skill 文件：归类为“版本特有”，默认跳过并列出
  `sourceFile` 名称，用户可临时导入该 Skill 后重试。

**菜单（MenuProfile）**

菜单树按 `path` 对齐（`path.join(' > ')`）。
- 子菜单 / 分隔线（无 command）：无条件同步布局；
- 命令项：命令命中 A/E 同步；B/C 跳过该项并在目标树中保留占位标记
  （`note: 仅源版本可用，未同步`）或整项跳过（默认整项跳过，避免生成失效菜单）；
- D：目标独有菜单项默认保留。

## 6. 核心流程

```text
工作区页 / 方案页 → “跨版本同步”
  1. 选择源环境 + 源方案（快捷键/Skill/菜单勾选）与目标环境
  2. 前置校验（M0）：源/目标 pcbenv 必须不同且都有效；目标环境可扫描
  3. 主进程组装源方案快照 + 目标环境命令集
  4. core/sync/planCrossVersionSync.ts 生成分类清单（纯函数）
  5. UI 展示 A/B/C/D 清单 + 原因 + 记忆规则勾选（每行可改：同步/跳过/每次询问）
  6. 确认 → 生成目标环境“新方案”预览（同名方案自动加“（同步）”后缀）
  7. 生成 Apply Plan（复用各模块 plan API，绑定目标环境上下文；trustedApplyPlan）
  8. 执行 → 备份 + change_history；跳过清单写入 sync_rules.json
```

默认不覆盖：目标环境生成**新方案**（快捷键/Skill/菜单各自一个新方案），
用户可勾选“覆盖同名现有方案”。生成后方案栏可对比、可切换，符合
“切换预览 / 应用确认”既有交互。

## 7. 新增模块与 IPC

### core/sync/（纯 TS，可测试）

| 文件 | 职责 |
|---|---|
| `commandAvailability.ts` | 构建目标环境命令集（从 `workspaceReferenceCheck` 提取公共匹配函数，内置命令 + Skill 命令两层） |
| `planCrossVersionSync.ts` | 分类算法：A/B/C/D 判定、差异组装、记忆规则应用 |
| `mergeProfiles.ts` | 按分类结果生成目标“新方案”内容（hotkey/skill/menu 三个纯函数） |
| `syncRules.ts` | `sync_rules.json` 读写 + 默认决策 |
| `environmentPairCheck.ts` | 前置校验：两环境独立（`path.normalize(...).toLowerCase()` 比较）、目录存在、可扫描 |

### electron/ipc/sync.ipc.ts

| 通道 | 说明 |
|---|---|
| `sync:check-env-pair` | 前置校验 + 目标环境命令集摘要 |
| `sync:build-plan` | 生成 `CrossVersionSyncPlan`（含记忆规则） |
| `sync:update-rule` | 更新某命令对决策（always_sync / always_skip / ask） |
| `sync:apply` | 生成目标新方案并返回预览/plan（走各模块 plan，不直接写最终文件） |

### 前端

- 入口：工作区页「更多操作」或方案栏新增「跨版本同步」；
- 弹窗三屏：①选择源/目标 ②差异清单（分组 + 勾选 + 原因 + 记忆规则）
  ③确认应用（新方案预览）；
- 复用 `GlobalStatusBar` 胶囊展示版本/环境状态，复用既有 Toast / ConfirmDialog。

## 8. 与现有功能衔接

- **引用校验**：同步前自动跑一次目标方案校验，阻塞项在差异清单中高亮；
- **兼容预检元数据**：生成的目标新方案写入
  `sourceEnvironmentId` / `sourceAllegroVersion` / `testedAllegroVersions` /
  `targetCompatibility`，下次跨版本应用时给出兼容提示；
- **导入重绑**：若两环境方案 ID 体系不同（如从另一台电脑同步），先走现有的
  “按名称推荐重绑”再同步；
- **工作区**：同步产物为新方案，用户在工作区配置中重新绑定即可；不自动改写工作区。

## 9. 边界与风险

1. **两环境必须独立 pcbenv**：注册表当前两个环境指向同一目录；共享目录时同步无意义
   （同一文件互覆）。`sync:check-env-pair` 检测到相同路径直接阻塞并引导到环境页修正。
2. **命令存在 ≠ 行为一致**：17.4 特有 Skill 同名命令在 17.2 中若存在但行为不同，
   同步仍会发生；由兼容预检 / 真机验证兜底，不做自动黑名单。
3. **Skill ID 跨环境不稳定**：路径不同则 ID 不同；按文件名/路径相似度匹配的策略
   可能出现歧义，歧义项列入待确认，不自动选择。
4. **菜单占位**：跳过的命令项不写入 generated_menu.il，避免低版本菜单出现失效入口。
5. **不做自动写文件之外的动作**：同步前不修改源方案；同步失败不产生任何部分写入
   （沿用 Apply Plan 的原子性）。
6. **规则记忆的边界**：规则按键（targetVersion + command）记忆，不跨版本混淆；
   用户修改源方案后旧规则仍生效，规则管理页可一键清空回默认。

## 10. 实施里程碑

| 阶段 | 内容 | 验证标准 |
|---|---|---|
| M0 前置 | 环境目录独立性校验 + 注册表修正指引；用户完成 17.4 pcbenv 修正 | 两环境路径可区分 |
| M1 命令集与分类 | `commandAvailability` + `planCrossVersionSync` 纯函数 + 单测 | A/B/C/D 全矩阵用例通过 |
| M2 计划 IPC 与 UI | `sync:build-plan` + 三屏弹窗骨架 + 差异清单展示 | 选择源/目标后可预览分类 |
| M3 合并与 Apply Plan | `mergeProfiles` + `sync:apply` + trustedApplyPlan + 新方案保存 | 17.4→17.2 生成新方案且命令过滤正确 |
| M4 双向与记忆 | 反向同步 + `sync_rules.json` + 规则管理 | 双向均可执行；规则记忆生效 |
| M5 收尾 | 用户/开发文档 + FEATURE_INDEX + `npm run verify` 全绿 + 真机验证 | 门禁通过；真机双版本跑通 |

### 实现说明（M0–M4，2026-08-29）

- **M0**：`core/sync/environmentPairCheck.ts`（同目录/同版本/目录缺失阻塞）；已将本机
  17.4 环境注册表路径修正到 `Cadence17\Cadence\SPB_Data`（原文件已备份为
  `environments.json.bak-20260829`）。
- **M1/M3**：`core/sync/commandAvailability.ts`（命令可用性索引）、
  `core/sync/planCrossVersionSync.ts`（A/B/C/D/E 分类）、
  `core/sync/mergeSyncProfiles.ts`（目标新方案合并，不覆盖现有）。
- **M4**：`core/sync/syncRules.ts`（`sync_rules.json` 规则记忆：always_sync /
  always_skip / ask）。
- **M2**：`electron/ipc/sync.ipc.ts`（environments / check-env-pair / build-plan /
  update-rule / apply）+ `src/components/sync/SyncDialog.tsx` 三屏弹窗
  （配置 → 差异清单 → 结果），工作区页新增「跨版本同步」入口。
- 空方案保护：源方案对象存在但快捷键/Skill/菜单内容全空时，计划直接阻塞并提示
  「请先在对应页面从当前环境构建并保存方案」。

## 11. 测试计划

**core 单测**：
- 分类矩阵：内置命令 / 17.4 独有 Skill 命令 / 目标独有 / 两边未知 / axlCmdRegister 注册命令；
- 快捷键同 key 不同命令、同命令多 key；skillId 路径不同时的名称匹配与歧义；
- 菜单嵌套（子菜单/分隔线/命令项）；B 类跳过不污染 `generated_menu.il` 内容；
- 幂等性：连续同步两次结果一致；记忆规则覆盖默认决策；
- 环境校验：相同路径阻塞、目录缺失阻塞、扫描失败给出原因。

**组件测试**：
- 同步对话框默认勾选状态（A 勾、B 不勾、D 保留）；
- 勾选修改 → plan 参数正确；规则“每次询问”交互；
- 新方案命名（“（同步）”后缀）、覆盖模式确认、失败 Toast。

## 12. 验收标准

1. 在 17.4 方案新增一个高版本命令 → 同步到 17.2 时该条目出现在“版本特有”且默认跳过，
   原因可读（“仅 17.4 的 Skill xxx 提供”）；
2. 通用命令修改 → 双向同步后两环境方案命令集一致（除隔离项）；
3. 同步产出为目标环境**新方案**，不覆盖现有，可对比、可回退；
4. 每一步写入走 Apply Plan；任一步失败不产生部分写入；
5. 两环境 pcbenv 相同或目标环境无 Skill 扫描结果时，给出明确阻塞提示而非静默跳过；
6. `npm run verify` 全绿，真机 17.2/17.4 各跑一遍同步后功能可用。

## 13. 待评审决策点

1. 同步产出默认“新方案” vs “覆盖现有”（推荐新方案 + 可勾选覆盖）；
2. 菜单 B 类：保留占位标记 vs 整项跳过（推荐整项跳过 + 清单可查）；
3. 规则记忆默认值：无提供者 → always_skip（推荐），还是首次 ask 一次后记忆；
4. 是否把“环境目录独立性校验”单独作为一个 M0 修复项先行处理
   （当前注册表两个环境指向同一 pcbenv，需要用户确认并修正）。
