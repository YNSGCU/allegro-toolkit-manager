/**
 * ATM - Rollback Manifest 生成模块
 * 生成/读取/验证回滚 manifest
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { RollbackManifest } from '../../src/types/environment';
import type { BackupFileEntry } from '../../src/types/environment';

/**
 * 生成 Rollback Manifest
 * @param backupResult 备份结果
 * @param reason 备份原因
 * @returns RollbackManifest
 */
export function generateRollbackManifest(
  backupResult: { backupId: string; files: BackupFileEntry[] },
  reason: string
): RollbackManifest {
  return {
    backupId: backupResult.backupId,
    createdAt: new Date().toISOString(),
    reason,
    files: backupResult.files.map((f) => ({
      originalPath: f.originalPath,
      backupPath: f.backupPath,
      sha256: f.sha256,
    })),
  };
}

/**
 * 将 Rollback Manifest 写入文件
 * @param manifest RollbackManifest
 * @param outputDir 输出目录（manifest 会保存到该目录）
 * @returns 写入路径
 */
export function writeRollbackManifest(
  manifest: RollbackManifest,
  outputDir: string
): { path: string; success: boolean; error?: string } {
  try {
    const normalizedDir = path.normalize(outputDir);
    if (!fs.existsSync(normalizedDir)) {
      fs.mkdirSync(normalizedDir, { recursive: true });
    }

    const manifestPath = path.join(normalizedDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
      encoding: 'utf-8',
    });

    return { path: manifestPath, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { path: '', success: false, error: `写入 manifest 失败: ${message}` };
  }
}

/**
 * 读取 Rollback Manifest
 * @param manifestPath manifest 文件路径
 * @returns RollbackManifest 或 null
 */
export function readRollbackManifest(
  manifestPath: string
): RollbackManifest | null {
  try {
    const normalizedPath = path.normalize(manifestPath);
    if (!fs.existsSync(normalizedPath)) {
      return null;
    }
    const content = fs.readFileSync(normalizedPath, { encoding: 'utf-8' });
    return JSON.parse(content) as RollbackManifest;
  } catch {
    return null;
  }
}

/**
 * 验证备份文件的完整性（校验 SHA256）
 * @param manifest RollbackManifest
 * @returns 验证结果
 */
export function verifyBackupIntegrity(
  manifest: RollbackManifest
): { valid: boolean; failedFiles: string[] } {
  const failedFiles: string[] = [];

  for (const file of manifest.files) {
    try {
      if (!fs.existsSync(file.backupPath)) {
        failedFiles.push(file.backupPath);
        continue;
      }
      const content = fs.readFileSync(file.backupPath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      if (hash !== file.sha256) {
        failedFiles.push(file.backupPath);
      }
    } catch {
      failedFiles.push(file.backupPath);
    }
  }

  return {
    valid: failedFiles.length === 0,
    failedFiles,
  };
}

/**
 * 执行回滚操作
 * @param manifest RollbackManifest
 * @returns 回滚结果
 */
export function executeRollback(
  manifest: RollbackManifest
): { success: boolean; restoredFiles: string[]; errors: string[] } {
  const restoredFiles: string[] = [];
  const errors: string[] = [];

  for (const file of manifest.files) {
    try {
      if (!fs.existsSync(file.backupPath)) {
        errors.push(`备份文件不存在: ${file.backupPath}`);
        continue;
      }

      // 确保目标目录存在
      const targetDir = path.dirname(file.originalPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 复制备份回原始位置
      fs.copyFileSync(file.backupPath, file.originalPath);
      restoredFiles.push(file.originalPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`回滚失败 ${file.originalPath}: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    restoredFiles,
    errors,
  };
}
