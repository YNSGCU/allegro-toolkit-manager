/**
 * ATM - pcbenv 目录检测模块
 * 验证指定路径是否为有效的 pcbenv 目录
 */
import fs from 'fs';
import path from 'path';
import type { PcbenvResult } from '../../src/types/environment';

/**
 * 检测给定基础路径下的 pcbenv 目录
 * @param basePath 基础路径（如 HOME）
 * @returns PcbenvResult
 */
export function detectPcbenv(basePath: string | null): PcbenvResult {
  const result: PcbenvResult = {
    path: null,
    exists: false,
    isValid: false,
    warnings: [],
  };

  if (!basePath) {
    result.warnings.push('基础路径为空');
    return result;
  }

  try {
    const normalizedBase = path.normalize(basePath);

    if (!fs.existsSync(normalizedBase)) {
      result.warnings.push(`基础路径不存在: ${normalizedBase}`);
      return result;
    }

    // 检测 pcbenv 子目录
    const pcbenvPath = path.join(normalizedBase, 'pcbenv');
    result.path = pcbenvPath;

    if (!fs.existsSync(pcbenvPath)) {
      result.warnings.push(`pcbenv 目录不存在: ${pcbenvPath}`);
      return result;
    }

    result.exists = true;

    // 验证是否为有效 pcbenv（至少包含 env 或 allegro.ilinit 之一）
    const hasEnv = fs.existsSync(path.join(pcbenvPath, 'env'));
    const hasIlinit = fs.existsSync(path.join(pcbenvPath, 'allegro.ilinit'));

    if (!hasEnv && !hasIlinit) {
      result.warnings.push('pcbenv 目录中未找到 env 或 allegro.ilinit 文件');
      return result;
    }

    result.isValid = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.warnings.push(`检测 pcbenv 时发生错误: ${message}`);
  }

  return result;
}

/**
 * 在常用位置搜索 pcbenv 目录
 * 只扫描已知候选位置，不做全盘搜索
 * @returns 候选路径列表
 */
export function searchCommonPcbenvLocations(): string[] {
  const candidates: string[] = [];

  try {
    // 1. HOME
    const home = process.env.HOME;
    if (home) candidates.push(path.join(home, 'pcbenv'));

    // 2. USERPROFILE
    const userProfile = process.env.USERPROFILE;
    if (userProfile) candidates.push(path.join(userProfile, 'pcbenv'));

    // 3. HOMEDRIVE + HOMEPATH
    const homeDrive = process.env.HOMEDRIVE;
    const homePath = process.env.HOMEPATH;
    if (homeDrive && homePath) {
      candidates.push(path.join(homeDrive + homePath, 'pcbenv'));
    }

    // 4. Cadence SPB_Data 常见路径
    const userProfileForCadence = process.env.USERPROFILE;
    if (userProfileForCadence) {
      candidates.push(path.join(userProfileForCadence, '..', 'Cadence', 'SPB_Data', 'pcbenv'));
    }

    // 5. D:/Cadence/SPB_Data/pcbenv
    candidates.push('D:\\Cadence\\SPB_Data\\pcbenv');
    candidates.push('C:\\Cadence\\SPB_Data\\pcbenv');

    // 6. 当前用户目录下的 Cadence
    if (userProfileForCadence) {
      candidates.push(path.join(userProfileForCadence, 'Cadence', 'SPB_Data', 'pcbenv'));
    }
  } catch {
    // 环境变量读取失败时静默处理
  }

  // 过滤出实际存在的目录
  return candidates.filter((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}
