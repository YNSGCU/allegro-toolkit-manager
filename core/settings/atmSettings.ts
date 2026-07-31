/**
 * ATM - 设置持久化模块（V3.0 多 env 支持）
 *
 * 管理 atm_settings.json，存储用户的多 env 配置偏好：
 *   - 活动用户 env 路径
 *   - 参考 env 路径列表
 *
 * 存储位置：{pcbenvPath}/atm_generated/settings/atm_settings.json
 */
import path from 'path';
import fs from 'fs';
import type { AtmSettings } from '../../src/types/environment';

const SETTINGS_DIR = 'atm_generated/settings';
const SETTINGS_FILE = 'atm_settings.json';
const CURRENT_VERSION = 1;

/**
 * 获取设置文件路径
 */
function getSettingsFilePath(pcbenvPath: string): string {
  return path.join(pcbenvPath, SETTINGS_DIR, SETTINGS_FILE);
}

/**
 * 获取设置目录路径
 */
function getSettingsDir(pcbenvPath: string): string {
  return path.join(pcbenvPath, SETTINGS_DIR);
}

/**
 * 确保设置目录存在
 */
function ensureSettingsDir(pcbenvPath: string): void {
  const dir = getSettingsDir(pcbenvPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 获取默认设置
 */
export function getDefaultSettings(): AtmSettings {
  return {
    version: CURRENT_VERSION,
    activeUserEnvPath: null,
    referenceEnvPaths: [],
    lastScanTime: undefined,
  };
}

/**
 * 加载设置
 * @param pcbenvPath pcbenv 目录路径
 * @returns AtmSettings（文件不存在时返回默认设置）
 */
export function loadSettings(pcbenvPath: string): AtmSettings {
  try {
    const filePath = getSettingsFilePath(pcbenvPath);
    if (!fs.existsSync(filePath)) {
      return getDefaultSettings();
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? CURRENT_VERSION,
      activeUserEnvPath: parsed.activeUserEnvPath ?? null,
      referenceEnvPaths: Array.isArray(parsed.referenceEnvPaths) ? parsed.referenceEnvPaths : [],
      lastScanTime: parsed.lastScanTime ?? undefined,
    };
  } catch {
    return getDefaultSettings();
  }
}

/**
 * 保存设置
 * @param pcbenvPath pcbenv 目录路径
 * @param settings 要保存的设置
 */
export function saveSettings(pcbenvPath: string, settings: AtmSettings): void {
  ensureSettingsDir(pcbenvPath);
  const filePath = getSettingsFilePath(pcbenvPath);

  const data: AtmSettings = {
    version: CURRENT_VERSION,
    activeUserEnvPath: settings.activeUserEnvPath ?? null,
    referenceEnvPaths: settings.referenceEnvPaths ?? [],
    lastScanTime: new Date().toISOString(),
  };

  // 原子写入：先写 .tmp，再 rename
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * 更新活动用户 env 路径
 */
export function setActiveEnvPath(pcbenvPath: string, envPath: string): AtmSettings {
  const settings = loadSettings(pcbenvPath);
  settings.activeUserEnvPath = envPath;
  saveSettings(pcbenvPath, settings);
  return settings;
}

/**
 * 添加参考 env 路径
 */
export function addReferenceEnvPath(pcbenvPath: string, refPath: string): AtmSettings {
  const settings = loadSettings(pcbenvPath);
  const normalized = path.normalize(refPath);
  if (!settings.referenceEnvPaths.some((p) => path.normalize(p).toLowerCase() === normalized.toLowerCase())) {
    settings.referenceEnvPaths.push(normalized);
  }
  saveSettings(pcbenvPath, settings);
  return settings;
}

/**
 * 移除参考 env 路径
 */
export function removeReferenceEnvPath(pcbenvPath: string, refPath: string): AtmSettings {
  const settings = loadSettings(pcbenvPath);
  const normalized = path.normalize(refPath).toLowerCase();
  settings.referenceEnvPaths = settings.referenceEnvPaths.filter(
    (p) => path.normalize(p).toLowerCase() !== normalized,
  );
  saveSettings(pcbenvPath, settings);
  return settings;
}
