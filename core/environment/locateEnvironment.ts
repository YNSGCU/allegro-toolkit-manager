/**
 * ATM - 环境定位模块
 * 自动检测 HOME/pcbenv/env/allegro.ilinit 路径
 */
import path from 'path';
import os from 'os';
import { detectPcbenv, searchCommonPcbenvLocations } from './detectPcbenv';
import { checkFileAccess, ensureDirectoryExists } from './fileAccess';
import type { EnvironmentInfo, HealthScore, HealthScoreItem } from '../../src/types/environment';

/**
 * 定位用户 Allegro 配置环境
 * 优先级：手动指定路径 > HOME > USERPROFILE > HOMEDRIVE+HOMEPATH > 常见路径
 * @param manualPcbenvPath 用户手动指定的 pcbenv 路径（可选）
 * @returns EnvironmentInfo
 */
export function locateEnvironment(manualPcbenvPath?: string): EnvironmentInfo {
  const warnings: string[] = [];
  let homePath: string | null = null;
  let pcbenvPath: string | null = null;

  // Step 1: 如果用户手动指定了路径，直接使用
  if (manualPcbenvPath) {
    const normalized = path.normalize(manualPcbenvPath);

    // 检查指定的是 pcbenv 目录本身还是上级目录
    if (normalized.endsWith('pcbenv') || normalized.endsWith('pcbenv\\')) {
      pcbenvPath = normalized;
      homePath = path.dirname(normalized);
    } else {
      // 可能是 HOME 目录，拼接 pcbenv
      homePath = normalized;
      pcbenvPath = path.join(normalized, 'pcbenv');
    }

    const result = detectPcbenv(homePath);
    if (result.isValid || result.exists) {
      pcbenvPath = result.path;
      if (!result.isValid) {
        warnings.push(`用户指定路径 ${manualPcbenvPath} 但未找到有效 pcbenv`);
      }
    }
  }

  // Step 2: 检测 HOME 环境变量
  if (!pcbenvPath) {
    const envHome = process.env.HOME;
    if (envHome) {
      homePath = envHome;
      const result = detectPcbenv(envHome);
      if (result.path && (result.isValid || result.exists)) {
        pcbenvPath = result.path;
      }
    }
  }

  // Step 3: 检测 USERPROFILE
  if (!pcbenvPath) {
    const envUserProfile = process.env.USERPROFILE;
    if (envUserProfile) {
      homePath = homePath || envUserProfile;
      const result = detectPcbenv(envUserProfile);
      if (result.path && (result.isValid || result.exists)) {
        pcbenvPath = result.path;
      }
    }
  }

  // Step 4: 检测 HOMEDRIVE + HOMEPATH
  if (!pcbenvPath) {
    const homeDrive = process.env.HOMEDRIVE;
    const homePathEnv = process.env.HOMEPATH;
    if (homeDrive && homePathEnv) {
      const combined = homeDrive + homePathEnv;
      homePath = homePath || combined;
      const result = detectPcbenv(combined);
      if (result.path && (result.isValid || result.exists)) {
        pcbenvPath = result.path;
      }
    }
  }

  // Step 5: 搜索常见位置
  if (!pcbenvPath) {
    const commonLocations = searchCommonPcbenvLocations();
    for (const loc of commonLocations) {
      const parentDir = path.dirname(loc);
      const result = detectPcbenv(parentDir);
      if (result.isValid) {
        homePath = homePath || parentDir;
        pcbenvPath = result.path;
        break;
      }
    }

    if (!pcbenvPath && commonLocations.length > 0) {
      // 有候选但都无效
      warnings.push('在常见位置未找到有效的 pcbenv 目录');
    }
  }

  // 使用 os.userInfo() 作为最后的 homePath 参考
  if (!homePath) {
    try {
      homePath = os.userInfo().homedir;
    } catch {
      homePath = null;
    }
  }

  // 构建完整路径
  const envFilePath = pcbenvPath ? path.join(pcbenvPath, 'env') : null;
  const ilinitFilePath = pcbenvPath ? path.join(pcbenvPath, 'allegro.ilinit') : null;
  const atmGeneratedPath = pcbenvPath ? path.join(pcbenvPath, 'atm_generated') : null;

  // 检测文件状态
  const envStatus = envFilePath ? checkFileAccess(envFilePath) : { exists: false, readable: false, writable: false, path: '' };
  const ilinitStatus = ilinitFilePath ? checkFileAccess(ilinitFilePath) : { exists: false, readable: false, writable: false, path: '' };
  const pcbenvStatus = pcbenvPath ? checkFileAccess(pcbenvPath) : { exists: false, readable: false, writable: false, path: '' };

  // 判断检测模式
  let detectedMode: EnvironmentInfo['detectedMode'] = 'unknown';
  if (pcbenvPath) {
    const upperDir = path.dirname(pcbenvPath).toLowerCase();
    if (upperDir.includes('spb_data') || upperDir.includes('cadence')) {
      detectedMode = 'cloud_install_user_config';
    } else {
      detectedMode = 'local';
    }
  }

  // 收集警告
  if (!pcbenvPath) {
    warnings.push('未找到 pcbenv 目录，请手动选择');
  }
  if (pcbenvPath && !envStatus.exists) {
    warnings.push('env 文件不存在');
  }
  if (pcbenvPath && !ilinitStatus.exists) {
    warnings.push('allegro.ilinit 文件不存在');
  }
  if (envStatus.exists && !envStatus.writable) {
    warnings.push('env 文件只读，无法写入');
  }

  return {
    homePath,
    pcbenvPath,
    envFilePath,
    ilinitFilePath,
    atmGeneratedPath,
    envExists: envStatus.exists,
    envReadable: envStatus.readable,
    envWritable: envStatus.writable,
    ilinitExists: ilinitStatus.exists,
    ilinitReadable: ilinitStatus.readable,
    ilinitWritable: ilinitStatus.writable,
    pcbenvExists: pcbenvStatus.exists,
    pcbenvWritable: pcbenvStatus.writable,
    detectedMode,
    warnings,
  };
}

/**
 * 计算环境健康评分
 * @param info EnvironmentInfo
 * @returns HealthScore
 */
export function calculateHealthScore(info: EnvironmentInfo): HealthScore {
  const items: HealthScoreItem[] = [];
  let score = 100;

  if (!info.pcbenvPath) {
    items.push({ reason: 'pcbenv 目录未找到', deduction: 15, category: 'environment' });
    score -= 15;
  }

  if (!info.envExists) {
    items.push({ reason: 'env 文件不存在', deduction: 10, category: 'environment' });
    score -= 10;
  } else if (!info.envWritable) {
    items.push({ reason: 'env 文件只读', deduction: 8, category: 'environment' });
    score -= 8;
  }

  if (!info.ilinitExists) {
    items.push({ reason: 'allegro.ilinit 文件不存在', deduction: 5, category: 'environment' });
    score -= 5;
  }

  if (!info.pcbenvWritable) {
    items.push({ reason: 'pcbenv 目录不可写', deduction: 10, category: 'environment' });
    score -= 10;
  }

  // 评分归一化
  score = Math.max(0, Math.min(100, score));

  let level: HealthScore['level'] = 'safe';
  if (score < 60) level = 'danger';
  else if (score < 80) level = 'warning';

  return { score, level, details: items };
}

/**
 * 确保 atm_generated 目录结构存在
 * @param pcbenvPath pcbenv 路径
 * @returns 是否成功
 */
export function ensureAtmDirectoryStructure(pcbenvPath: string): { success: boolean; error?: string } {
  const dirs = [
    path.join(pcbenvPath, 'atm_generated'),
    path.join(pcbenvPath, 'atm_generated', 'backup'),
    path.join(pcbenvPath, 'atm_generated', 'logs'),
  ];

  for (const dir of dirs) {
    const result = ensureDirectoryExists(dir);
    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}
