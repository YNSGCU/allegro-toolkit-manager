import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AllegroEnvironmentWorkspace, EnvironmentRegistry } from '../../src/types/environment';
import { checkFileAccess } from './fileAccess';

const REGISTRY_VERSION = 1;
const REGISTRY_FILE = 'environments.json';

function configRoot(): string {
  const override = process.env.ATM_CONFIG_HOME;
  if (override) return path.normalize(override);
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'AllegroToolkitManager');
}

export function getEnvironmentRegistryPath(): string {
  return path.join(configRoot(), REGISTRY_FILE);
}

function normalize(value: string): string {
  return path.normalize(value).replace(/[\\/]+$/, '').toLowerCase();
}

function readRegistry(): EnvironmentRegistry {
  try {
    const raw = fs.readFileSync(getEnvironmentRegistryPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.environments)) {
      return {
        version: parsed.version ?? REGISTRY_VERSION,
        activeEnvironmentId: parsed.activeEnvironmentId ?? null,
        environments: parsed.environments,
        manualInstallRoots: Array.isArray(parsed.manualInstallRoots) ? parsed.manualInstallRoots : [],
        updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      };
    }
  } catch {
    // 首次运行或注册表损坏时回到空状态，由扫描流程重建。
  }
  return {
    version: REGISTRY_VERSION,
    activeEnvironmentId: null,
    environments: [],
    manualInstallRoots: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function loadEnvironmentRegistry(): EnvironmentRegistry {
  return readRegistry();
}

export function saveEnvironmentRegistry(registry: EnvironmentRegistry): EnvironmentRegistry {
  const filePath = getEnvironmentRegistryPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const data = { ...registry, version: REGISTRY_VERSION, updatedAt: new Date().toISOString() };
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  return data;
}

function versionFromPath(value: string): string | null {
  const match = value.match(/(?:SPB[_-]?|Allegro[_ -]?)(\d+\.\d+)/i);
  return match?.[1] ?? null;
}

function executableForRoot(root: string): string | null {
  const candidates = [
    path.join(root, 'tools', 'bin', 'allegro.exe'),
    path.join(root, 'tools', 'bin', 'allegro.bat'),
    path.join(root, 'bin', 'allegro.exe'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function installRoots(): string[] {
  const roots: string[] = [];
  const add = (value: string | undefined) => {
    if (!value) return;
    const normalized = path.normalize(value);
    if (!roots.some((item) => normalize(item) === normalize(normalized))) roots.push(normalized);
  };
  add(process.env.CDSROOT);
  for (const manual of loadEnvironmentRegistry().manualInstallRoots ?? []) {
    add(manual);
  }
  const bases = [
    'C:\\Cadence',
    'D:\\Cadence',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Cadence'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Cadence'),
    // 常见自定义安装位置（嵌套层级更深，如 D:\\application\\Cadence\\Cadence17_2\\Cadence\\SPB_17.2）
    'C:\\application\\Cadence',
    'D:\\application\\Cadence',
    // ATM_CADENCE_BASES 环境变量可追加更多安装基础目录（分号分隔）
    ...(process.env.ATM_CADENCE_BASES ? process.env.ATM_CADENCE_BASES.split(';').filter(Boolean) : []),
  ];
  for (const base of bases) {
    try {
      collectSpbRoots(base, add, 0, 4);
    } catch {
      // 不存在的常见安装目录直接跳过。
    }
  }
  return roots;
}

/**
 * 递归收集 SPB 安装根目录。
 *
 * Cadence 安装结构差异很大，例如：
 *   C:\\Cadence\\SPB_17.2                      （一层）
 *   D:\\application\\Cadence\\Cadence17\\Cadence\\SPB_17.4 （三层）
 * 因此从基目录递归向下查找名为 SPB_xx.x / Allegro_xx.x 的目录。
 */
function collectSpbRoots(
  base: string,
  add: (value: string | undefined) => void,
  depth: number,
  maxDepth: number,
): void {
  if (depth > maxDepth) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(base, entry.name);
    if (/^(SPB|ALLEGRO)[_-]?\d+/i.test(entry.name)) {
      add(full);
      // 命中后不再向下深入（避免进入 SPB_17.4 内部目录）
      continue;
    }
    collectSpbRoots(full, add, depth + 1, maxDepth);
  }
}

function workspaceFromPcbenv(pcbenvPath: string, installRoot: string | null, source: AllegroEnvironmentWorkspace['source']): AllegroEnvironmentWorkspace {
  const normalizedPcbenv = path.normalize(pcbenvPath);
  const version = installRoot ? versionFromPath(installRoot) : versionFromPath(normalizedPcbenv);
  const executablePath = installRoot ? executableForRoot(installRoot) : null;
  const access = checkFileAccess(normalizedPcbenv);
  const id = `env_${crypto.createHash('sha1').update(`${normalize(normalizedPcbenv)}|${normalize(installRoot || '')}`).digest('hex').slice(0, 12)}`;
  return {
    id,
    name: version ? `Allegro ${version}` : '用户 Allegro 环境',
    allegroVersion: version,
    installRoot,
    executablePath,
    homePath: path.dirname(normalizedPcbenv),
    pcbenvPath: normalizedPcbenv,
    envFilePath: path.join(normalizedPcbenv, 'env'),
    ilinitFilePath: path.join(normalizedPcbenv, 'allegro.ilinit'),
    writable: access.writable,
    exists: access.exists,
    sharedWithIds: [],
    source,
    lastVerifiedAt: new Date().toISOString(),
  };
}

export function discoverEnvironmentWorkspaces(manualPcbenvPath?: string): AllegroEnvironmentWorkspace[] {
  const workspaces: AllegroEnvironmentWorkspace[] = [];
  const seen = new Set<string>();
  const add = (workspace: AllegroEnvironmentWorkspace) => {
    const key = `${normalize(workspace.pcbenvPath)}|${normalize(workspace.installRoot || '')}`;
    if (!seen.has(key)) {
      seen.add(key);
      workspaces.push(workspace);
    }
  };

  const manual = manualPcbenvPath
    ? (manualPcbenvPath.toLowerCase().endsWith('pcbenv') ? manualPcbenvPath : path.join(manualPcbenvPath, 'pcbenv'))
    : null;
  if (manual) add(workspaceFromPcbenv(manual, null, 'manual'));

  const roots = installRoots();
  // 防止把其他版本共享的 SPB_Data 目录误判为独立 HOME，Cadence 多版本安装时
  // 常见：17.4 的 root 旁边就是 17.2 的 SPB_Data，不能当作额外环境
  const siblingDataByRoot = new Map(
    roots.map((root) => [root, path.join(path.dirname(root), 'SPB_Data')]),
  );
  const otherSiblingData = new Set(roots.map((root) => siblingDataByRoot.get(root)).filter(Boolean));
  for (const root of roots) {
    const homeCandidates = [
      process.env.HOME,
      process.env.USERPROFILE,
      process.env.HOMEDRIVE && process.env.HOMEPATH ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}` : undefined,
      process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Cadence', 'SPB_Data') : undefined,
      process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '..', 'Cadence', 'SPB_Data') : undefined,
      // 某些安装布局会把 HOME 直接指向 Cadence/SPB_Data，而真正的 Cadence 安装根在上级目录：
      //   D:\application\Cadence\Cadence17_2\Cadence\SPB_17.2
      //   D:\application\Cadence\Cadence17_2\Cadence\SPB_Data
      root ? path.join(path.dirname(root), 'SPB_Data') : undefined,
    ].filter(Boolean) as string[];
    for (const home of homeCandidates) {
      const candidate = home.toLowerCase().endsWith('pcbenv') ? home : path.join(home, 'pcbenv');
      // 如果候选 HOME 是其他版本安装根的 SPB_Data，则跳过，避免重复注册
      if (home !== siblingDataByRoot.get(root) && otherSiblingData.has(home)) continue;
      if (fs.existsSync(candidate)) add(workspaceFromPcbenv(candidate, root, 'discovered'));
    }
    if (!workspaces.some((item) => item.installRoot && normalize(item.installRoot) === normalize(root))) {
      const fallback = path.join(os.homedir(), 'pcbenv');
      if (fs.existsSync(fallback)) add(workspaceFromPcbenv(fallback, root, 'discovered'));
    }
  }

  if (workspaces.length === 0) {
    const fallback = process.env.HOME || process.env.USERPROFILE;
    if (fallback) {
      const pcbenv = fallback.toLowerCase().endsWith('pcbenv') ? fallback : path.join(fallback, 'pcbenv');
      if (fs.existsSync(pcbenv)) add(workspaceFromPcbenv(pcbenv, null, 'discovered'));
    }
  }

  const byPcbenv = new Map<string, AllegroEnvironmentWorkspace[]>();
  for (const workspace of workspaces) {
    const key = normalize(workspace.pcbenvPath);
    const group = byPcbenv.get(key) || [];
    group.push(workspace);
    byPcbenv.set(key, group);
  }
  for (const group of byPcbenv.values()) {
    if (group.length > 1) {
      for (const workspace of group) workspace.sharedWithIds = group.filter((item) => item.id !== workspace.id).map((item) => item.id);
    }
  }
  return workspaces;
}

export function refreshEnvironmentRegistry(manualPcbenvPath?: string): EnvironmentRegistry {
  const discovered = discoverEnvironmentWorkspaces(manualPcbenvPath);
  const current = readRegistry();
  const merged = [...discovered];
  for (const old of current.environments) {
    if (!merged.some((item) => item.id === old.id)) merged.push(old);
  }
  const manualEnvironmentId = manualPcbenvPath
    ? discovered.find((item) => item.source === 'manual')?.id
    : null;
  const activeEnvironmentId = manualEnvironmentId || (current.activeEnvironmentId && merged.some((item) => item.id === current.activeEnvironmentId)
    ? current.activeEnvironmentId
    : merged[0]?.id ?? null);
  return saveEnvironmentRegistry({
    version: REGISTRY_VERSION,
    activeEnvironmentId,
    environments: merged,
    manualInstallRoots: current.manualInstallRoots ?? [],
    updatedAt: current.updatedAt,
  });
}

export function setActiveEnvironment(environmentId: string): EnvironmentRegistry {
  const current = readRegistry();
  if (!current.environments.some((item) => item.id === environmentId)) throw new Error('目标 Allegro 环境不存在');
  return saveEnvironmentRegistry({ ...current, activeEnvironmentId: environmentId });
}

export function getActiveEnvironment(): AllegroEnvironmentWorkspace | null {
  const current = readRegistry();
  return current.environments.find((item) => item.id === current.activeEnvironmentId) || null;
}

export function getActiveEnvironmentPcbenvPath(): string | undefined {
  return getActiveEnvironment()?.pcbenvPath;
}

/**
 * 手动添加 Allegro 安装根目录（SPB_xx.x 级别）
 *
 * 用于新电脑上自动扫描未覆盖到的安装位置。
 * 添加后立即刷新发现，并持久化到注册表。
 */
export function addManualInstallRoot(installRoot: string): EnvironmentRegistry {
  const normalized = path.normalize(installRoot);
  const registry = loadEnvironmentRegistry();
  const roots = registry.manualInstallRoots ?? [];
  if (!roots.some((item) => normalize(item) === normalize(normalized))) {
    roots.push(normalized);
  }
  registry.manualInstallRoots = roots;
  // 先保存手动目录（refresh 会重新读取注册表），再刷新发现
  saveEnvironmentRegistry(registry);
  return refreshEnvironmentRegistry();
}

/**
 * 移除手动添加的安装根目录
 */
export function removeManualInstallRoot(installRoot: string): EnvironmentRegistry {
  const normalized = path.normalize(installRoot);
  const registry = loadEnvironmentRegistry();
  registry.manualInstallRoots = (registry.manualInstallRoots ?? []).filter(
    (item) => normalize(item) !== normalize(normalized),
  );
  saveEnvironmentRegistry(registry);
  return refreshEnvironmentRegistry();
}
