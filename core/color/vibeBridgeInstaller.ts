/**
 * ATM - Vibe Bridge 自动加载安装器
 *
 * 原理：Vibe Bridge 服务端（vibe_server.il）必须运行在 Allegro 进程内，
 * 桌面应用无法直接执行 SKILL。本模块将加载命令写入用户
 * allegro.ilinit（Allegro 启动时自动执行），使桥接在 Allegro 每次
 * 启动时自动加载，无需用户在命令窗手动敲 skill load。
 *
 * 所有写入操作通过 Apply Plan 完成（备份 + 修改 ilinit）。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ApplyPlan } from '../../src/types/applyPlan';
import { createApplyPlan } from '../apply/applyPlanEngine';
import { readAllegroTextFile, type AllegroTextEncoding } from '../environment/allegroTextEncoding';

/** Vibe Bridge 服务端文件名 */
export const VIBE_SERVER_FILE = 'vibe_server.il';

/** 候选桥接项目根目录（workspace 的上级） */
export function candidateBridgeRoots(): string[] {
  const candidates = [
    process.env.ATM_VIBE_BRIDGE_HOME,
    path.join(os.homedir(), '.codex', 'skills', 'allegro-vibe-bridge'),
    path.join(os.homedir(), 'allegro_vibe_bridge'),
  ].filter(Boolean) as string[];
  return [...new Set(candidates.map((item) => path.normalize(item)))];
}

/** 定位 vibe_server.il 文件 */
export function findBridgeServerFile(): string | null {
  for (const root of candidateBridgeRoots()) {
    const candidate = path.join(root, VIBE_SERVER_FILE);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** 生成加载行，例如 load("C:/.../vibe_server.il") */
export function buildBridgeLoadLine(serverPath: string): string {
  const normalized = serverPath.replace(/\\/g, '/');
  return `load("${normalized}")`;
}

/** 检测 ilinit 是否已配置桥接加载（按服务端路径精确匹配） */
export function hasBridgeLoadInIlinit(content: string, serverPath: string): boolean {
  const normalized = path.normalize(serverPath).toLowerCase().replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.il$/i, '');
  return content
    .split(/\r?\n/)
    .some((line) => {
      const trimmed = line.trim().toLowerCase().replace(/\\/g, '/');
      if (!trimmed.startsWith('load(')) return false;
      return trimmed.includes(withoutExt) || trimmed.includes(normalized);
    });
}

/** 向 ilinit 插入桥接加载行（已存在返回 null） */
export function insertBridgeLoadToIlinit(
  currentContent: string,
  loadLine: string,
  serverPath: string,
): string | null {
  if (hasBridgeLoadInIlinit(currentContent, serverPath)) {
    return null;
  }
  const trimmedContent = currentContent.endsWith('\n')
    ? currentContent
    : currentContent + '\n';
  const separator = currentContent.trim() ? '\n' : '';
  return (
    trimmedContent +
    separator +
    `; ATM Vibe Bridge auto-load - managed by ATM\n${loadLine}\n`
  );
}

/** 生成启用桥接的 Apply Plan（备份 + 修改 ilinit） */
export function buildBridgeEnablePlan(
  ilinitPath: string,
  currentContent: string,
  serverPath: string,
  backupDir: string,
  textEncoding: AllegroTextEncoding = 'utf8',
  forceEncodingRewrite = false,
): ApplyPlan | null {
  const loadLine = buildBridgeLoadLine(serverPath);
  const nextContent = insertBridgeLoadToIlinit(currentContent, loadLine, serverPath);
  const contentToWrite = nextContent ?? (forceEncodingRewrite ? currentContent : null);
  if (contentToWrite === null) return null;

  const backupFile = path.join(backupDir, 'allegro.ilinit');
  return createApplyPlan({
    module: 'environment',
    title: '启用 Vibe Bridge 自动加载',
    description: '将桥接服务加载命令写入 allegro.ilinit，Allegro 启动时自动运行桥接。',
    requiresRestart: true,
    steps: [
      {
        type: 'backup_file',
        title: '备份 allegro.ilinit',
        description: `备份到 ${backupFile}`,
        targetFile: ilinitPath,
        backupTo: backupFile,
      },
      {
        type: 'modify_ilinit',
        title: '写入桥接加载命令',
        description: `追加 ${loadLine}`,
        targetFile: ilinitPath,
        before: currentContent,
        after: contentToWrite,
      },
    ],
    risks: [
      {
        id: 'bridge-restart',
        severity: 'info',
        title: '需重启 Allegro 生效',
        description: '写入后请重启 Allegro（或下次启动时自动生效）。',
      },
    ],
    backups: [
      {
        sourceFile: ilinitPath,
        backupFile,
        required: true,
      },
    ],
    targetFiles: [ilinitPath],
    environmentPcbenvPath: path.dirname(ilinitPath),
    allegroTextEncoding: textEncoding,
  });
}

/** 桥接安装状态 */
export interface BridgeSetupStatus {
  serverFile: string | null;
  ilinitPath: string | null;
  ilinitExists: boolean;
  configured: boolean;
  canEnable: boolean;
}

/** 检查桥接安装状态 */
export function checkBridgeSetup(
  ilinitPath: string,
  textEncoding: AllegroTextEncoding = 'utf8',
): BridgeSetupStatus {
  const serverFile = findBridgeServerFile();
  const ilinitExists = fs.existsSync(ilinitPath);
  const currentContent = ilinitExists ? readAllegroTextFile(ilinitPath, textEncoding).text : '';
  const configured = serverFile !== null && hasBridgeLoadInIlinit(currentContent, serverFile);
  return {
    serverFile,
    ilinitPath,
    ilinitExists,
    configured,
    canEnable: serverFile !== null && !configured,
  };
}
