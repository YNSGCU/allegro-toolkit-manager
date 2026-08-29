/**
 * ATM - 同步规则记忆（V6.4，M4）
 *
 * 用户对「命令 + 目标版本」的同步决策记忆，存储于
 * %APPDATA%/AllegroToolkitManager/sync_rules.json（应用级资源）。
 * 默认决策：目标环境有提供者 → always_sync；无提供者 → always_skip。
 */
import fs from 'fs';
import path from 'path';
import { configRoot } from '../color/colorSchemeManager';
import type {
  CrossVersionSyncRule,
  SyncRuleDecision,
  SyncRuleStore,
} from '../../src/types/sync';

export const SYNC_RULES_VERSION = '1.0';

export function getSyncRulesPath(): string {
  return path.join(configRoot(), 'sync_rules.json');
}

export function createEmptySyncRuleStore(): SyncRuleStore {
  return {
    version: SYNC_RULES_VERSION,
    rules: [],
    updatedAt: new Date().toISOString(),
  };
}

/** 加载规则存储（不存在或损坏时回退到空存储） */
export function loadSyncRuleStore(): SyncRuleStore {
  try {
    const filePath = getSyncRulesPath();
    if (!fs.existsSync(filePath)) return createEmptySyncRuleStore();
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<SyncRuleStore>;
    if (raw && Array.isArray(raw.rules)) {
      return {
        version: raw.version ?? SYNC_RULES_VERSION,
        rules: raw.rules,
        updatedAt: raw.updatedAt ?? new Date().toISOString(),
      };
    }
  } catch {
    // 损坏时回退空存储
  }
  return createEmptySyncRuleStore();
}

/** 保存规则存储（原子写入） */
export function saveSyncRuleStore(store: SyncRuleStore): void {
  const filePath = getSyncRulesPath();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
    } catch {
      // 临时文件清理失败不覆盖原始错误
    }
    throw new Error(`保存同步规则失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** 归一化命令（与命令索引一致） */
export function normalizeRuleCommand(command: string): string {
  return command.trim().replace(/^["']|["']$/g, '').replace(/[;]$/, '').trim().toLowerCase();
}

/** 查询某命令对的自定义决策；无规则时返回 undefined（由调用方应用默认决策） */
export function findRule(
  store: SyncRuleStore,
  command: string,
  targetVersion: string,
): CrossVersionSyncRule | undefined {
  const key = normalizeRuleCommand(command);
  return store.rules.find(
    (rule) =>
      normalizeRuleCommand(rule.command) === key &&
      (rule.targetVersion || '').toLowerCase() === (targetVersion || '').toLowerCase(),
  );
}

/** 设置（新增/更新）一条规则，返回更新后的存储 */
export function setRule(
  store: SyncRuleStore,
  command: string,
  targetVersion: string,
  decision: SyncRuleDecision,
  note?: string,
): SyncRuleStore {
  const key = normalizeRuleCommand(command);
  const versionKey = (targetVersion || '').toLowerCase();
  const existing = store.rules.find(
    (rule) =>
      normalizeRuleCommand(rule.command) === key &&
      (rule.targetVersion || '').toLowerCase() === versionKey,
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.decision = decision;
    existing.note = note?.trim() || existing.note;
    existing.updatedAt = now;
  } else {
    store.rules.push({ command: key, targetVersion, decision, note: note?.trim() || undefined, updatedAt: now });
  }
  return store;
}

/** 删除一条规则，返回更新后的存储 */
export function removeRule(store: SyncRuleStore, command: string, targetVersion: string): SyncRuleStore {
  const key = normalizeRuleCommand(command);
  const versionKey = (targetVersion || '').toLowerCase();
  store.rules = store.rules.filter(
    (rule) =>
      !(normalizeRuleCommand(rule.command) === key && (rule.targetVersion || '').toLowerCase() === versionKey),
  );
  return store;
}

/** 清理全部规则（恢复默认行为） */
export function clearRules(store: SyncRuleStore): SyncRuleStore {
  store.rules = [];
  return store;
}
