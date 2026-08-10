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

/**
 * 共享关系始终由当前注册表中的真实 pcbenv 分组重建，禁止沿用已经不存在的环境 ID。
 */
function rebuildSharedRelationships(
  environments: AllegroEnvironmentWorkspace[],
): AllegroEnvironmentWorkspace[] {
  const normalized = environments.map(environment => ({ ...environment, sharedWithIds: [] }));
  const byPcbenv = new Map<string, AllegroEnvironmentWorkspace[]>();
  for (const environment of normalized) {
    const key = normalize(environment.pcbenvPath);
    const group = byPcbenv.get(key) || [];
    group.push(environment);
    byPcbenv.set(key, group);
  }
  for (const group of byPcbenv.values()) {
    if (group.length < 2) continue;
    for (const environment of group) {
      environment.sharedWithIds = group
        .filter(peer => peer.id !== environment.id)
        .map(peer => peer.id);
    }
  }
  return normalized;
}

function environmentSelectionPriority(environment: AllegroEnvironmentWorkspace): number {
  let priority = 0;
  if (environment.installRoot) {
    const installPcbenv = path.join(path.dirname(environment.installRoot), 'SPB_Data', 'pcbenv');
    if (normalize(environment.pcbenvPath) === normalize(installPcbenv)) priority += 100;
  }
  if (environment.source === 'manual') priority += 50;
  if (environment.exists) priority += 10;
  if (environment.writable) priority += 5;
  return priority;
}

/**
 * 下拉环境以 Allegro 版本为唯一维度。同版本有多个 pcbenv 时优先保留当前选择；
 * 没有当前选择时优先使用该版本安装目录旁的 SPB_Data/pcbenv。
 */
export function selectEnvironmentPerVersion(
  environments: AllegroEnvironmentWorkspace[],
  preferredEnvironmentId: string | null = null,
): AllegroEnvironmentWorkspace[] {
  const versioned = new Map<string, AllegroEnvironmentWorkspace[]>();
  const unversioned: AllegroEnvironmentWorkspace[] = [];
  for (const environment of environments) {
    if (!environment.allegroVersion) {
      unversioned.push(environment);
      continue;
    }
    const group = versioned.get(environment.allegroVersion) || [];
    group.push(environment);
    versioned.set(environment.allegroVersion, group);
  }

  const selected = Array.from(versioned.entries())
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, group]) => group.find(item => item.id === preferredEnvironmentId)
      ?? [...group].sort((left, right) => {
        const priorityDiff = environmentSelectionPriority(right) - environmentSelectionPriority(left);
        return priorityDiff || left.id.localeCompare(right.id);
      })[0]);

  return [...selected, ...unversioned];
}

function readRegistry(): EnvironmentRegistry {
  try {
    const raw = fs.readFileSync(getEnvironmentRegistryPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.environments)) {
      const deduplicated = selectEnvironmentPerVersion(
        parsed.environments,
        parsed.activeEnvironmentId ?? null,
      );
      const previousActive = parsed.environments.find(
        (environment: AllegroEnvironmentWorkspace) => environment.id === parsed.activeEnvironmentId,
      );
      const activeEnvironmentId = deduplicated.some(item => item.id === parsed.activeEnvironmentId)
        ? parsed.activeEnvironmentId
        : deduplicated.find(item => item.allegroVersion === previousActive?.allegroVersion)?.id
          ?? deduplicated[0]?.id
          ?? null;
      return {
        version: parsed.version ?? REGISTRY_VERSION,
        activeEnvironmentId,
        environments: rebuildSharedRelationships(deduplicated),
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
  const data = {
    ...registry,
    version: REGISTRY_VERSION,
    environments: rebuildSharedRelationships(selectEnvironmentPerVersion(
      registry.environments,
      registry.activeEnvironmentId,
    )),
    updatedAt: new Date().toISOString(),
  };
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

  return rebuildSharedRelationships(workspaces);
}

export function refreshEnvironmentRegistry(manualPcbenvPath?: string): EnvironmentRegistry {
  const discovered = discoverEnvironmentWorkspaces(manualPcbenvPath);
  const current = readRegistry();
  const merged = [...discovered];
  for (const old of current.environments) {
    const shouldPreserve = old.source !== 'discovered' || fs.existsSync(old.pcbenvPath);
    if (shouldPreserve && !merged.some((item) => item.id === old.id)) merged.push(old);
  }
  const manualEnvironmentId = manualPcbenvPath
    ? discovered.find((item) => item.source === 'manual')?.id
    : null;
  const preferredEnvironmentId = manualEnvironmentId || current.activeEnvironmentId;
  const selected = selectEnvironmentPerVersion(merged, preferredEnvironmentId);
  const previousActive = current.environments.find(item => item.id === current.activeEnvironmentId);
  const activeEnvironmentId = preferredEnvironmentId && selected.some(item => item.id === preferredEnvironmentId)
    ? preferredEnvironmentId
    : selected.find(item => item.allegroVersion === previousActive?.allegroVersion)?.id
      ?? selected[0]?.id
      ?? null;
  return saveEnvironmentRegistry({
    version: REGISTRY_VERSION,
    activeEnvironmentId,
    environments: rebuildSharedRelationships(selected),
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
