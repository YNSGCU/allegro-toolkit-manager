/**
 * ATM - Env 编辑器 Apply Plan 执行模块
 *
 * 把编辑后的条目序列化回 env 文本，通过统一 Apply Plan 引擎写入：
 * 备份 + 事务快照 + 写入 + 失败回滚 + 变更历史。
 */
import path from 'path';
import type { AllegroTextEncoding } from '../environment/allegroTextEncoding';
import {
  createApplyPlan,
  createBackupStep,
  executeApplyPlan,
} from '../apply/applyPlanEngine';
import type { ApplyResult } from '../../src/types/applyPlan';
import type { EnvEditorEntry } from '../../src/types/envEditor';
import { renderEnvDocument } from './envDocument';

export interface EnvEditorApplyInput {
  filePath: string;
  entries: EnvEditorEntry[];
  encoding: AllegroTextEncoding;
  pcbenvPath: string;
}

/** 执行 Env 编辑器写入（备份 + write_file + 回滚 + 历史） */
export async function applyEnvEditor(input: EnvEditorApplyInput): Promise<ApplyResult> {
  const newContent = renderEnvDocument(input.entries);
  const backupDir = path.join(input.pcbenvPath, 'atm_generated', 'backup');
  const historyDir = path.join(input.pcbenvPath, 'atm_generated', 'history');
  const backup = createBackupStep(input.filePath, backupDir);

  const plan = createApplyPlan({
    title: '编辑 env 文件',
    description: `可视化编辑 ${path.basename(input.filePath)}`,
    module: 'environment',
    steps: [
      backup.step,
      {
        type: 'write_file',
        title: '写入 env 文件',
        description: `写入 ${path.basename(input.filePath)}`,
        targetFile: input.filePath,
        after: newContent,
        textEncoding: input.encoding,
      },
    ],
    backups: [backup.backup],
    requiresRestart: true,
    targetFiles: [input.filePath],
  });

  return executeApplyPlan(plan, { backupDir, historyDir });
}
