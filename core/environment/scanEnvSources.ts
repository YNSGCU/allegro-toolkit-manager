/**
 * ATM - 多 env 来源扫描器（V3.0）
 *
 * 自动检测所有可能的 env 文件：
 *   1. 用户 pcbenv 路径（HOME/USERPROFILE/HOMEDRIVE+PATH）
 *   2. Allegro 安装目录默认 env
 *   3. CDS_SITE/公司站点 env
 *   4. 用户手动添加的参考 env
 *
 * 每个检测到的 env 文件生成一个 EnvSource，包含角色、可读写状态、优先级等信息。
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { checkFileAccess } from './fileAccess';
import { detectPcbenv, searchCommonPcbenvLocations } from './detectPcbenv';
import type {
  EnvSource, EnvSourceList, EnvRole, AtmSettings,
} from '../../src/types/environment';

let _idCounter = 0;
function nextId(): string {
  return `env_${_idCounter++}`;
}

/**
 * 获取 env 在文件中的快捷数量（扫描 funckey/alias 行）
 */
function countHotkeys(envPath: string): number {
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    let count = 0;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('funckey ') || trimmed.startsWith('alias ')) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * 获取文件最后修改时间 ISO 字符串
 */
function getLastModified(filePath: string): string | undefined {
  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * 构建一个 EnvSource 对象
 */
function buildEnvSource(
  envFilePath: string,
  role: EnvRole,
  priority: number,
  isReference: boolean,
  displayName: string,
): EnvSource {
  const access = checkFileAccess(envFilePath);
  return {
    id: nextId(),
    path: path.normalize(envFilePath),
    role,
    readable: access.readable,
    writable: access.writable,
    exists: access.exists,
    priority,
    hotkeyCount: access.exists ? countHotkeys(envFilePath) : 0,
    lastModified: access.exists ? getLastModified(envFilePath) : undefined,
    selectedAsActive: false,
    isReference,
    displayName,
  };
}

/**
 * 扫描全部可能的 Allegro 配置环境（安装目录默认 env）
 */
function findInstallDefaultEnv(): string | null {
  // 1. CDSROOT 环境变量
  const cdsRoot = process.env.CDSROOT;
  if (cdsRoot) {
    const candidate = path.join(cdsRoot, 'share', 'pcb', 'text', 'env');
    if (fs.existsSync(candidate)) return path.normalize(candidate);
    // 有时在 share/pcb/text/ 下叫 env.dat
    const candidateDat = path.join(cdsRoot, 'share', 'pcb', 'text', 'env.dat');
    if (fs.existsSync(candidateDat)) return path.normalize(candidateDat);
  }

  // 2. 常见 Allegro 安装路径
  const commonInstallPaths = [
    'C:\\Cadence\\SPB_17.4\\share\\pcb\\text\\env',
    'C:\\Cadence\\SPB_17.2\\share\\pcb\\text\\env',
    'C:\\Cadence\\SPB_16.6\\share\\pcb\\text\\env',
    'C:\\Program Files\\Cadence\\SPB_17.4\\share\\pcb\\text\\env',
    'C:\\Program Files\\Cadence\\SPB_17.2\\share\\pcb\\text\\env',
  ];

  for (const candidate of commonInstallPaths) {
    if (fs.existsSync(candidate)) return path.normalize(candidate);
  }

  return null;
}

/**
 * 扫描 CDS_SITE 路径下的站点 env
 */
function findSiteEnv(): string | null {
  const cdsSite = process.env.CDS_SITE;
  if (cdsSite) {
    const candidate = path.join(cdsSite, 'pcbenv', 'env');
    if (fs.existsSync(candidate)) return path.normalize(candidate);
  }
  return null;
}

/**
 * 构建用户 home 路径列表（含 SPB_Data 常见位置）
 */
function getUserHomeCandidates(): string[] {
  const candidates: string[] = [];

  // HOME（Git Bash/MSYS2 中常见）
  if (process.env.HOME) candidates.push(process.env.HOME);

  // USERPROFILE（Windows 标准）
  if (process.env.USERPROFILE) {
    const up = process.env.USERPROFILE;
    if (!candidates.includes(up)) candidates.push(up);
  }

  // HOMEDRIVE + HOMEPATH
  const hd = process.env.HOMEDRIVE;
  const hp = process.env.HOMEPATH;
  if (hd && hp) {
    const combined = path.join(hd, hp);
    if (!candidates.includes(combined)) candidates.push(combined);
  }

  // SPB_Data 常见位置
  for (const home of [...candidates]) {
    const spbCandidates = [
      path.join(home, 'Cadence', 'SPB_Data'),
      path.join(home, '..', 'Cadence', 'SPB_Data'),
    ];
    for (const spb of spbCandidates) {
      if (!candidates.includes(spb)) candidates.push(spb);
    }
  }

  // os.userInfo() 保底
  try {
    const homedir = os.userInfo().homedir;
    if (!candidates.includes(homedir)) candidates.push(homedir);
  } catch {
    // ignore
  }

  return candidates;
}

/**
 * 从 home 路径中找到可写 pcbenv/env
 */
function findUserEnvFromHomes(homes: string[]): { envPath: string | null; pcbenvPath: string | null } {
  for (const home of homes) {
    const result = detectPcbenv(home);
    if (result.isValid && result.path) {
      const envPath = path.join(result.path, 'env');
      if (fs.existsSync(envPath)) {
        return { envPath: path.normalize(envPath), pcbenvPath: result.path };
      }
    }
  }
  // 放宽：只检查 pcbenv 目录存在但不要求所有文件
  for (const home of homes) {
    const result = detectPcbenv(home);
    if (result.exists && result.path) {
      const envPath = path.join(result.path, 'env');
      if (fs.existsSync(envPath)) {
        return { envPath: path.normalize(envPath), pcbenvPath: result.path };
      }
    }
  }
  return { envPath: null, pcbenvPath: null };
}

/**
 * 扫描所有已知的 env 来源
 *
 * @param settings 当前保存的设置（可能包含参考路径）
 * @param manualPcbenvPath 手动指定的 pcbenv 路径（可选）
 * @returns EnvSourceList
 */
export function scanEnvSources(
  settings?: AtmSettings | null,
  manualPcbenvPath?: string,
): EnvSourceList {
  _idCounter = 0;
  const sources: EnvSource[] = [];
  const addedPaths = new Set<string>();

  function addIfNotDuplicate(src: EnvSource): void {
    const normalized = src.path.toLowerCase();
    if (!addedPaths.has(normalized)) {
      addedPaths.add(normalized);
      sources.push(src);
    }
  }

  // ── 1. 手动指定路径 ──
  if (manualPcbenvPath) {
    const normalized = path.normalize(manualPcbenvPath);
    const isPcbenvDir = normalized.endsWith('pcbenv') || normalized.endsWith('pcbenv\\');
    const pcbenvDir = isPcbenvDir ? normalized : path.join(normalized, 'pcbenv');
    const envPath = path.join(pcbenvDir, 'env');
    addIfNotDuplicate(buildEnvSource(
      envPath, 'user_env', 0, false, '用户指定 env',
    ));
  }

  // ── 2. 用户 home 路径 → 找到 pcbenv/env ──
  const homeCandidates = getUserHomeCandidates();
  const { envPath: userEnvPath, pcbenvPath: userPcbenvPath } = findUserEnvFromHomes(homeCandidates);

  if (userEnvPath && !manualPcbenvPath) {
    // 没有手动指定时，最先找到的用户 env 为活动 env
    const userSource = buildEnvSource(
      userEnvPath, 'user_env', 1, false, '用户配置 env',
    );
    addIfNotDuplicate(userSource);
  } else if (userEnvPath && manualPcbenvPath) {
    // 已有手动指定，用户 home 中找到的作为参考
    const refSource = buildEnvSource(
      userEnvPath, 'user_env', 10, true, '用户配置 env（备用）',
    );
    addIfNotDuplicate(refSource);
  }

  // ── 3. Allegro 安装目录默认 env ──
  const installEnv = findInstallDefaultEnv();
  if (installEnv) {
    addIfNotDuplicate(buildEnvSource(
      installEnv, 'install_default_env', 20, true, '安装默认 env',
    ));
  }

  // ── 4. CDS_SITE 站点 env ──
  const siteEnv = findSiteEnv();
  if (siteEnv) {
    addIfNotDuplicate(buildEnvSource(
      siteEnv, 'site_env', 30, true, '站点配置 env',
    ));
  }

  // ── 5. 用户手动添加的参考 env（来自设置） ──
  if (settings?.referenceEnvPaths) {
    for (let i = 0; i < settings.referenceEnvPaths.length; i++) {
      const refPath = settings.referenceEnvPaths[i];
      if (fs.existsSync(refPath)) {
        addIfNotDuplicate(buildEnvSource(
          refPath, 'reference_env', 40 + i, true, `参考 env ${i + 1}`,
        ));
      }
    }
  }

  // 设置 selectedAsActive
  const activePath = settings?.activeUserEnvPath
    ? path.normalize(settings.activeUserEnvPath)
    : null;

  let activeEnvId: string | null = null;
  let activeEnvPath: string | null = null;

  for (const src of sources) {
    // 检查是否是保存的活动 env
    if (activePath && src.path.toLowerCase() === activePath.toLowerCase()) {
      src.selectedAsActive = true;
      activeEnvId = src.id;
      activeEnvPath = src.path;
    }
  }

  // 如果没有活动 env，选择第一个非参考、可写的 user_env
  if (!activeEnvId) {
    const writableUser = sources.find(
      (s) => s.role === 'user_env' && !s.isReference && s.writable,
    );
    if (writableUser) {
      writableUser.selectedAsActive = true;
      activeEnvId = writableUser.id;
      activeEnvPath = writableUser.path;
    }
  }

  return { sources, activeEnvId, activeEnvPath };
}
