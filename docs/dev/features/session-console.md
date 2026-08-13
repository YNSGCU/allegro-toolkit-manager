# Allegro 会话控制台

> 状态：M1–M3 已完成（快照 / 命令执行 / 页面），M4 收尾中
> 更新：2026-08-13

## 目标

把 ATM 从「配置器」升级为「实时控制台」：通过 Vibe Bridge 查看当前 Allegro 会话的
版本、设计名与单位，执行只读 / 写 SKILL 命令，并在应用配置后实时验证生效状态。
整合现有零散的桥接能力（配色捕获/应用、DRC 抓取、环境探测）。

## 范围

**做**

- 只读会话快照：版本 / 程序名 / 当前设计名 / 设计单位
- SKILL 命令执行通道（复用 executeSkillViaBridge）
- 只读 / 写命令分类：写命令需二次确认
- 控制台页面：连接状态 + 快照 + 命令输入 + 输出历史
- 快捷操作：抓取 DRC、捕获配色、应用后验证

**不做**

- 不直接修改设计数据库（写命令需明确确认，且记录历史）
- 不内置任意 SKILL 编辑器语言服务

## 数据模型（`src/types/session.ts`）

```ts
interface SessionSnapshot {
  connected: boolean;
  fullVersion?: string;
  programName?: string;
  designName?: string;
  designUnits?: string;
  message?: string;
}
```

## 核心模块（`core/session/sessionProbe.ts`）

- `buildSessionSnapshotSkill`：只读 SKILL（axlVersion / axlCurrentDesign / axlDBGetDesignUnits）
- `parseSessionSnapshot`：解析 %L 输出
- `probeSession`：复用 executeSkillViaBridge 抓取快照

## 里程碑

| 阶段 | 内容 |
|---|---|
| M1 会话快照 | 只读探针 + 解析 + 单测 |
| M2 命令执行 | 安全命令通道 + 读写分类 + IPC |
| M3 控制台页面 | /session 路由 + 快照 + 命令输入 + 历史 |
| M4 收尾 | 快捷操作 + 文档 + verify |

## 安全边界

- 快照与只读命令不写设计；写命令需明确确认并记录历史
- 命令长度 / 超时限制，防止长阻塞
- 不暴露任意文件读取能力
