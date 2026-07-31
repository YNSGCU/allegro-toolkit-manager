import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

/**
 * 变更历史模块 — 记录每次 Apply Plan 应用，支持撤销上次操作
 */

export interface ChangeRecord {
  id: string;
  timestamp: string;
  operation: 'modify_env' | 'add_env_line' | 'comment_env_line' | 'plan_apply' | 'undo' | 'restore';
  summary: string;
  targetFile: string;
  backupFile: string;
  backupId: string;
  stepsCount: number;
  planId: string;
  undoable: boolean;
  previousHistoryBackup?: string; // 撤销前备份的历史文件路径，用于重做
  restorePoint?: boolean; // 是否为恢复点
}

export interface ChangeHistory {
  records: ChangeRecord[];
}

function getHistoryPath(pcbenvPath: string): string {
  const dir = path.join(pcbenvPath, 'atm_generated', 'history');
  return path.join(dir, 'change_history.json');
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function loadChangeHistory(pcbenvPath: string): ChangeHistory {
  try {
    const historyPath = getHistoryPath(pcbenvPath);
    if (fs.existsSync(historyPath)) {
      const raw = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(raw) as ChangeHistory;
    }
  } catch {
    // 文件损坏等情况，返回空历史
  }
  return { records: [] };
}

export function saveChangeHistory(pcbenvPath: string, history: ChangeHistory): void {
  const historyPath = getHistoryPath(pcbenvPath);
  const dir = path.dirname(historyPath);
  ensureDir(dir);
  const tmpPath = historyPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(history, null, 2), 'utf-8');
  fs.renameSync(tmpPath, historyPath);
}

export function addChangeRecord(pcbenvPath: string, record: Omit<ChangeRecord, 'id' | 'timestamp'>): ChangeRecord {
  const history = loadChangeHistory(pcbenvPath);
  const fullRecord: ChangeRecord = {
    ...record,
    id: crypto.createHash('sha256').update(Date.now() + record.summary + Math.random().toString()).digest('hex').slice(0, 12),
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
  history.records.unshift(fullRecord); // 最新的在前面
  // 保留最近 100 条
  if (history.records.length > 100) {
    history.records = history.records.slice(0, 100);
  }
  saveChangeHistory(pcbenvPath, history);
  return fullRecord;
}

export function getLastChangeRecord(pcbenvPath: string): ChangeRecord | null {
  const history = loadChangeHistory(pcbenvPath);
  const undoableRecords = history.records.filter(r => r.undoable);
  return undoableRecords.length > 0 ? undoableRecords[0] : null;
}

export function canUndoLastChange(pcbenvPath: string): { canUndo: boolean; record: ChangeRecord | null } {
  const record = getLastChangeRecord(pcbenvPath);
  if (!record) return { canUndo: false, record: null };
  // 检查备份文件是否存在
  if (!fs.existsSync(record.backupFile)) {
    return { canUndo: false, record };
  }
  return { canUndo: true, record };
}

/**
 * 撤销上一次变更 — 从备份恢复目标文件
 */
export function undoLastChange(pcbenvPath: string): { success: boolean; error?: string; record?: ChangeRecord } {
  const { canUndo, record } = canUndoLastChange(pcbenvPath);
  if (!record) {
    return { success: false, error: '没有可撤销的变更记录' };
  }
  if (!canUndo) {
    return { success: false, error: `备份文件不存在: ${record?.backupFile}` };
  }

  try {
    // 检查目标文件是否可写
    if (fs.existsSync(record.targetFile)) {
      const targetDir = path.dirname(record.targetFile);
      try {
        fs.accessSync(targetDir, fs.constants.W_OK);
      } catch {
        return { success: false, error: `目标目录不可写: ${targetDir}` };
      }
    }

    // 撤销前备份当前文件（以便重做）
    const backupDir = path.join(pcbenvPath, 'atm_generated', 'backup');
    ensureDir(backupDir);
    const preUndoBackupId = `pre_undo_${Date.now()}`;
    const preUndoBackupFile = path.join(backupDir, `${preUndoBackupId}_${path.basename(record.targetFile)}`);

    if (fs.existsSync(record.targetFile)) {
      fs.copyFileSync(record.targetFile, preUndoBackupFile);
    }

    // 从备份恢复目标文件
    fs.copyFileSync(record.backupFile, record.targetFile);

    // 标记原记录不可撤销
    const history = loadChangeHistory(pcbenvPath);
    const recIdx = history.records.findIndex(r => r.id === record.id);
    if (recIdx >= 0) {
      history.records[recIdx].undoable = false;
    }
    saveChangeHistory(pcbenvPath, history);

    // 添加撤销记录
    const undoRecord = addChangeRecord(pcbenvPath, {
      operation: 'undo',
      summary: `撤销操作: ${record.summary}`,
      targetFile: record.targetFile,
      backupFile: preUndoBackupFile,
      backupId: preUndoBackupId,
      stepsCount: 1,
      planId: record.planId,
      undoable: true,
      previousHistoryBackup: record.backupFile,
    });

    return { success: true, record: undoRecord };
  } catch (err: any) {
    return { success: false, error: `撤销失败: ${err.message}` };
  }
}

/**
 * 获取某个时间点后的变更记录
 */
export function getChangesSince(pcbenvPath: string, sinceTime: string): ChangeRecord[] {
  const history = loadChangeHistory(pcbenvPath);
  return history.records.filter(r => r.timestamp >= sinceTime);
}

/**
 * 清除所有变更历史
 */
export function clearChangeHistory(pcbenvPath: string): void {
  saveChangeHistory(pcbenvPath, { records: [] });
}
