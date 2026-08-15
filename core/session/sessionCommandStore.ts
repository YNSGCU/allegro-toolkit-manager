/**
 * ATM - 会话控制台命令历史 / 收藏持久化
 *
 * 存储位置：%APPDATA%/AllegroToolkitManager/session_commands.json
 * 记录最近执行的命令（按 code 去重置顶，最多 50 条），支持收藏标记。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  SessionCommandRecord,
  SessionCommandRisk,
  SessionCommandStore,
} from '../../src/types/session';

const STORE_FILE = 'session_commands.json';
const MAX_ITEMS = 50;

export function getSessionStorePath(): string {
  const override = process.env.ATM_CONFIG_HOME;
  const root = override
    ? path.normalize(override)
    : path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'AllegroToolkitManager');
  return path.join(root, STORE_FILE);
}

export function createEmptyStore(): SessionCommandStore {
  return { version: 1, items: [] };
}

/** 记录一条命令：按 code 去重置顶，保留收藏状态；返回新 store（纯函数，不落盘） */
export function recordSessionCommand(
  store: SessionCommandStore,
  code: string,
  risk: SessionCommandRisk,
  success: boolean,
): SessionCommandStore {
  const existing = store.items.find((item) => item.code === code);
  const others = store.items.filter((item) => item.code !== code);
  const item: SessionCommandRecord = {
    code,
    risk,
    executedAt: new Date().toISOString(),
    success,
    favorite: existing?.favorite ?? false,
  };
  return { version: store.version, items: [item, ...others].slice(0, MAX_ITEMS) };
}

/** 切换某条命令的收藏状态；返回新 store（纯函数，不落盘） */
export function toggleSessionFavorite(store: SessionCommandStore, code: string): SessionCommandStore {
  return {
    version: store.version,
    items: store.items.map((item) => (item.code === code ? { ...item, favorite: !item.favorite } : item)),
  };
}

export function loadSessionCommands(): SessionCommandStore {
  try {
    if (!fs.existsSync(getSessionStorePath())) return createEmptyStore();
    const raw = fs.readFileSync(getSessionStorePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SessionCommandStore>;
    if (!parsed || !Array.isArray(parsed.items)) return createEmptyStore();
    return { version: parsed.version ?? 1, items: parsed.items.slice(0, MAX_ITEMS) };
  } catch {
    return createEmptyStore();
  }
}

export function saveSessionCommands(store: SessionCommandStore): void {
  const filePath = getSessionStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}
