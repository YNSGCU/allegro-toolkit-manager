/**
 * ATM - 备份创建模块
 * 创建 env、allegro.ilinit 等文件的备份
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ensureDirectoryExists } from '../environment/fileAccess';
import type { BackupResult, BackupFileEntry } from '../../src/types/environment';

/**
 * 计算文件的 SHA256 哈希
 * @param filePath 文件路径
 * @returns SHA256 哈希字符串
 */
function computeSha256(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return 'unknown';
  }
}

/**
 * 创建备份 ID（基于当前时间）
 * @returns 备份 ID，格式: YYYY-MM-DD_HHmmss
 */
export function generateBackupId(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${date}_${time}`;
}

/**
 * 创建文件备份
 * @param filePath 要备份的原始文件路径
 * @param backupDir 备份目录（如 pcbenv/atm_generated/backup）
 * @param reason 备份原因
 * @returns BackupResult
 */
export function createBackup(
  filePath: string,
  backupDir: string,
  reason: string = 'before modification'
): BackupResult {
  const backupId = generateBackupId();

  try {
    const normalizedPath = path.normalize(filePath);

    if (!fs.existsSync(normalizedPath)) {
      return {
        backupId,
        backupDir,
        files: [],
        success: false,
        error: `文件不存在: ${filePath}`,
      };
    }

    // 创建备份子目录
    const timestampBackupDir = path.join(backupDir, backupId);
    const dirResult = ensureDirectoryExists(timestampBackupDir);
    if (!dirResult.success) {
      return {
        backupId,
        backupDir,
        files: [],
        success: false,
        error: dirResult.error,
      };
    }

    // 复制文件
    const fileName = path.basename(normalizedPath);
    const backupPath = path.join(timestampBackupDir, fileName);
    fs.copyFileSync(normalizedPath, backupPath);

    // 计算哈希
    const sha256 = computeSha256(backupPath);
    const stats = fs.statSync(normalizedPath);

    const fileEntry: BackupFileEntry = {
      originalPath: normalizedPath,
      backupPath,
      sha256,
      size: stats.size,
    };

    return {
      backupId,
      backupDir: timestampBackupDir,
      files: [fileEntry],
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      backupId,
      backupDir,
      files: [],
      success: false,
      error: `备份失败: ${message}`,
    };
  }
}

/**
 * 批量创建备份
 * @param filePaths 要备份的文件路径列表
 * @param backupDir 备份目录
 * @param reason 备份原因
 * @returns 合并后的备份结果
 */
export function createBatchBackup(
  filePaths: string[],
  backupDir: string,
  reason: string = 'before batch modification'
): BackupResult {
  const backupId = generateBackupId();
  const allFiles: BackupFileEntry[] = [];

  try {
    const timestampBackupDir = path.join(backupDir, backupId);
    const dirResult = ensureDirectoryExists(timestampBackupDir);
    if (!dirResult.success) {
      return {
        backupId,
        backupDir,
        files: [],
        success: false,
        error: dirResult.error,
      };
    }

    for (const filePath of filePaths) {
      try {
        const normalizedPath = path.normalize(filePath);
        if (!fs.existsSync(normalizedPath)) continue;

        const fileName = path.basename(normalizedPath);
        const backupPath = path.join(timestampBackupDir, fileName);
        fs.copyFileSync(normalizedPath, backupPath);

        const sha256 = computeSha256(backupPath);
        const stats = fs.statSync(normalizedPath);

        allFiles.push({
          originalPath: normalizedPath,
          backupPath,
          sha256,
          size: stats.size,
        });
      } catch {
        // 单个文件备份失败不影响其他文件
      }
    }

    return {
      backupId,
      backupDir: timestampBackupDir,
      files: allFiles,
      success: allFiles.length > 0,
      error: allFiles.length === 0 ? '没有成功备份任何文件' : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      backupId,
      backupDir,
      files: allFiles,
      success: false,
      error: `批量备份失败: ${message}`,
    };
  }
}
