# Env 可视化编辑器

> 状态：M1–M3 已完成，M4（文档 / 发布）收尾中
> 更新：2026-08-13

## 目标

把可写的用户 `env` 文件按条目可视化编辑：funckey、alias、`set` 变量、注释、未知原始行都
保留并分类展示，支持新增 / 编辑 / 注释删除，生成行级 diff 预览，确认后经 Apply Plan
安全写入（备份 + 回滚 + 变更历史），并按 Allegro 版本选择 GBK / UTF-8 编码。

## 范围

**做**

- 复用 `core/parser/parseEnv`，并把 raw 行进一步识别为 `set/unset` 变量
- 文档模型：条目列表 + 原始行保留 + dirty/deleted 标记
- 渲染序列化：未修改行原样保留，修改行按类型重新生成
- 编辑 patch：新增 / 修改 / 注释删除
- 行级 diff 预览
- Apply Plan 写入（复用备份 / 回滚 / 历史）

**不做**

- 不编辑 install-dir env / company env / site env（只编辑用户可写 env）
- 不解析 funckey/alias 之外的任意 SKILL 语法
- 不引入绕过 Apply Plan 的直接写入

## 数据模型（`src/types/envEditor.ts`）

```ts
type EnvEditorEntryType = 'funckey' | 'alias' | 'variable' | 'comment' | 'blank' | 'raw';

interface EnvEditorEntry {
  id: string;              // 已有条目 `line_<n>`，新增 `new_<uuid>`
  type: EnvEditorEntryType;
  key?: string;
  value?: string;
  raw: string;
  lineNumber: number;      // 0 = 新增
  source: 'user_original' | 'atm_managed';
  dirty: boolean;
  deleted: boolean;
}
```

## 核心模块（`core/env/envDocument.ts`）

| 函数 | 职责 |
|---|---|
| `parseEnvDocument` | 复用 parseEnv，识别 set 变量，生成文档 |
| `renderEnvDocument` | 条目序列化回 env 文本（未修改原样，修改行重新生成，删除注释原行） |
| `applyPatch` | 新增 / 修改 / 删除单个条目 |
| `buildEditSteps` | 生成行级 before/after 预览 |

## 里程碑

| 阶段 | 内容 |
|---|---|
| M1 文档模型 | 类型 + 解析 / 渲染 / patch / diff + 单测 |
| M2 存储与 IPC | `env:editor-load / preview / apply`，编码探测 |
| M3 页面 | 编辑器路由 / 条目表 / 编辑弹窗 / diff 预览 |
| M4 收尾 | 文档 + `npm run verify` |

## 安全边界

- 只读 install-dir/company/site env，不提供编辑入口
- 写入走 Apply Plan，SHA-256 备份 + 回滚 manifest + change_history
- 删除采用注释原行（可撤销），不物理删除
