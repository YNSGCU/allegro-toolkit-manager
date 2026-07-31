/**
 * ATM - 文件访问检测模块
 * 检测文件/目录的存在性、可读性、可写性
 */
import fs from 'fs';
import path from 'path';
import type { FileStatus } from '../../src/types/environment';

/**
 * 检测文件或目录的存在性、可读性、可写性
 * @param targetPath 文件或目录路径
 * @returns FileStatus 对象
 */
export function checkFileAccess(targetPath: string): FileStatus {
  const result: FileStatus = {
    exists: false,
    readable: false,
    writable: false,
    path: targetPath,
  };

  if (!targetPath || targetPath.trim() === '') {
    result.error = '路径为空';
    return result;
  }

  try {
    // 规范化路径
    const normalizedPath = path.normalize(targetPath);

    // 检查是否存在
    result.exists = fs.existsSync(normalizedPath);

    if (!result.exists) {
      return result;
    }

    // 检查可读性 - 以同步方式尝试打开
    try {
      fs.accessSync(normalizedPath, fs.constants.R_OK);
      result.readable = true;
    } catch {
      result.readable = false;
    }

    // 检查可写性
    try {
      fs.accessSync(normalizedPath, fs.constants.W_OK);
      result.writable = true;
    } catch {
      result.writable = false;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.error = `检测路径失败: ${message}`;
  }

  return result;
}

/**
 * 检测目录是否可写（尝试创建临时文件）
 * @param dirPath 目录路径
 * @returns 是否可写
 */
export function checkDirectoryWritable(dirPath: string): boolean {
  try {
    const normalizedPath = path.normalize(dirPath);

    if (!fs.existsSync(normalizedPath)) {
      // 目录不存在，尝试创建
      fs.mkdirSync(normalizedPath, { recursive: true });
    }

    // 尝试写入临时文件
    const testFile = path.join(normalizedPath, `.atm_write_test_${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test', { encoding: 'utf-8' });
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 * @returns 创建成功或已存在
 */
export function ensureDirectoryExists(dirPath: string): { success: boolean; error?: string } {
  try {
    const normalizedPath = path.normalize(dirPath);
    if (!fs.existsSync(normalizedPath)) {
      fs.mkdirSync(normalizedPath, { recursive: true });
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `创建目录失败: ${message}` };
  }
}

/**
 * 读取文件内容（UTF-8），支持非 ASCII 字符
 * @param filePath 文件路径
 * @returns 文件内容
 */
export function readFileContent(filePath: string): { content: string; error?: string } {
  try {
    const normalizedPath = path.normalize(filePath);
    const content = fs.readFileSync(normalizedPath, { encoding: 'utf-8' });
    return { content };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: '', error: `读取文件失败: ${message}` };
  }
}

/**
 * 写入文件内容（UTF-8）
 * @param filePath 文件路径
 * @param content 文件内容
 */
export function writeFileContent(filePath: string, content: string): { success: boolean; error?: string } {
  try {
    const normalizedPath = path.normalize(filePath);
    // 确保父目录存在
    const parentDir = path.dirname(normalizedPath);
    ensureDirectoryExists(parentDir);
    fs.writeFileSync(normalizedPath, content, { encoding: 'utf-8' });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `写入文件失败: ${message}` };
  }
}

/**
 * 检查 Allegro 进程是否正在运行
 * @returns 是否检测到运行中的 Allegro
 */
export function checkAllegroRunning(): { running: boolean; error?: string } {
  try {
    // Windows 下通过进程名检测
    const { execSync } = require('child_process');
    const result = execSync('tasklist /FI "IMAGENAME eq allegro.exe" /NH', {
      encoding: 'utf-8',
      timeout: 3000,
    });
    const running = result.includes('allegro.exe');
    return { running };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { running: false, error: `检测 Allegro 进程失败: ${message}` };
  }
}
