/**
 * ATM - Env 可视化编辑器 IPC 处理器
 *
 * 只编辑当前活动 Allegro 环境的用户 env（可写），写入走统一 Apply Plan。
 */
import { ipcMain } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import type {
  EnvEditorApplyInput,
  EnvEditorEntry,
  EnvEditorLoadResult,
  EnvEditorPreviewResult,
} from '../../src/types/envEditor';
import { loadEnvironmentRegistry } from '../../core/environment/environmentRegistry';
import { readAllegroTextFile } from '../../core/environment/allegroTextEncoding';
import {
  buildEditSteps,
  parseEnvDocument,
  renderEnvDocument,
} from '../../core/env/envDocument';
import { applyEnvEditor } from '../../core/env/envApply';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

function getActiveEnv() {
  const registry = loadEnvironmentRegistry();
  const active = registry.environments.find((item) => item.id === registry.activeEnvironmentId);
  return { registry, active };
}

export function registerEnvEditorIpc(): void {
  ipcMain.handle('env:editor-load', () => {
    try {
      const { active } = getActiveEnv();
      if (!active) return { success: false, error: '未选择 Allegro 环境。' };
      if (!active.exists) return { success: false, error: '当前环境的 pcbenv 不存在。' };
      if (!active.writable) return { success: false, error: '当前环境的 env 为只读，不支持编辑。' };
      if (!fs.existsSync(active.envFilePath)) {
        return { success: false, error: '当前环境未找到 env 文件。' };
      }

      const decoded = readAllegroTextFile(active.envFilePath);
      const document = parseEnvDocument(decoded.text);
      document.filePath = active.envFilePath;
      const data: EnvEditorLoadResult = {
        filePath: active.envFilePath,
        encoding: decoded.detectedEncoding,
        contentHash: sha256(decoded.text),
        document,
      };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: `加载 env 编辑器失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('env:editor-preview', (_event, entries: EnvEditorEntry[]) => {
    try {
      if (!Array.isArray(entries)) return { success: false, error: '编辑器数据无效。' };
      const newContent = renderEnvDocument(entries);
      const steps = buildEditSteps(entries);
      const data: EnvEditorPreviewResult = { steps, newContent };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: `生成 env 预览失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('env:editor-apply', async (_event, input: EnvEditorApplyInput) => {
    try {
      const { active } = getActiveEnv();
      if (!active) return { success: false, error: '未选择 Allegro 环境。' };
      if (!active.writable || !active.exists) {
        return { success: false, error: '当前环境的 env 不可写。' };
      }
      if (!Array.isArray(input?.entries)) return { success: false, error: '编辑器数据无效。' };

      const decoded = readAllegroTextFile(active.envFilePath);
      if (decoded.detectedEncoding !== input.encoding) {
        return { success: false, error: 'env 文件编码已变化，请重新加载编辑器。' };
      }
      const currentHash = sha256(decoded.text);
      if (currentHash !== input.expectedHash) {
        return { success: false, error: 'env 文件已被外部修改，请重新加载后再编辑。' };
      }

      const result = await applyEnvEditor({
        filePath: active.envFilePath,
        entries: input.entries,
        encoding: input.encoding,
        pcbenvPath: active.pcbenvPath,
      });
      return { success: result.success, data: result, error: result.success ? undefined : result.error };
    } catch (err) {
      return { success: false, error: `应用 env 编辑失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
