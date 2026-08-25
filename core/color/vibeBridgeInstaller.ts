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
import type { ApplyPlan, ApplyPlanBackup, ApplyPlanRisk, ApplyPlanStep } from '../../src/types/applyPlan';
import { createApplyPlan } from '../apply/applyPlanEngine';
import { getAllegroTextEncoding, readAllegroTextFile, type AllegroTextEncoding } from '../environment/allegroTextEncoding';

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

/** 需要检查/写入桥接加载配置的 Allegro 环境目标 */
export interface BridgeInstallTarget {
  environmentId: string | null;
  allegroVersion?: string | null;
  ilinitPath: string;
}

/** 单个环境的桥接安装状态 */
export interface BridgeEnvironmentStatus extends BridgeSetupStatus {
  environmentId: string | null;
  allegroVersion?: string | null;
}

/** 多环境桥接安装状态汇总（供配色页展示） */
export interface BridgeSetupSummary {
  serverFile: string | null;
  ilinitPath: string | null;
  /** 所有目标环境是否均已配置 */
  configured: boolean;
  /** 是否存在至少一个可配置的环境 */
  canEnable: boolean;
  environments: BridgeEnvironmentStatus[];
  /** 缺失 allegro.ilinit 的环境数量 */
  missingIlinit: number;
  total: number;
}

/** 按各环境的版本编码检查桥接安装状态 */
export function checkBridgeSetupForEnvironments(
  targets: BridgeInstallTarget[],
): BridgeEnvironmentStatus[] {
  const serverFile = findBridgeServerFile();
  return targets.map((target) => {
    const textEncoding = getAllegroTextEncoding(target.allegroVersion);
    const ilinitExists = fs.existsSync(target.ilinitPath);
    const currentContent = ilinitExists
      ? readAllegroTextFile(target.ilinitPath, textEncoding).text
      : '';
    const configured = serverFile !== null && hasBridgeLoadInIlinit(currentContent, serverFile);
    return {
      environmentId: target.environmentId,
      allegroVersion: target.allegroVersion ?? null,
      serverFile,
      ilinitPath: target.ilinitPath,
      ilinitExists,
      configured,
      canEnable: serverFile !== null && !configured,
    };
  });
}

/** 汇总多环境安装状态，供 IPC 直接返回给渲染层 */
export function summarizeBridgeSetup(
  environments: BridgeEnvironmentStatus[],
): BridgeSetupSummary {
  const serverFile = findBridgeServerFile();
  const configured = environments.length > 0 && environments.every((item) => item.configured);
  const canEnable = environments.some((item) => item.canEnable);
  return {
    serverFile,
    ilinitPath: environments[0]?.ilinitPath ?? null,
    configured,
    canEnable,
    environments,
    missingIlinit: environments.filter((item) => !item.ilinitExists).length,
    total: environments.length,
  };
}

/**
 * 生成一个覆盖所有目标环境的桥接自动加载 Apply Plan。
 *
 * 同一个计划包含每个环境的备份与 ilinit 修改步骤；任一环境失败时，
 * 统一 Apply Plan 引擎会按备份回滚所有已写入文件，避免只配置一半。
 */
export function buildAllEnvironmentsBridgeEnablePlan(
  targets: BridgeInstallTarget[],
  serverPath: string,
  backupBaseDir: string,
): ApplyPlan | null {
  const steps: Array<Omit<ApplyPlanStep, 'id' | 'status'>> = [];
  const backups: ApplyPlanBackup[] = [];
  const targetFiles: string[] = [];

  targets.forEach((target, index) => {
    const textEncoding = getAllegroTextEncoding(target.allegroVersion);
    const currentContent = fs.existsSync(target.ilinitPath)
      ? readAllegroTextFile(target.ilinitPath, textEncoding).text
      : '';
    const loadLine = buildBridgeLoadLine(serverPath);
    const nextContent = insertBridgeLoadToIlinit(currentContent, loadLine, serverPath);
    if (nextContent === null) return;

    const safeSuffix = (target.environmentId || `env_${index}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const backupDir = path.join(backupBaseDir, safeSuffix);
    const backupFile = path.join(backupDir, 'allegro.ilinit');
    const label = target.allegroVersion
      ? `Allegro ${target.allegroVersion}`
      : path.basename(path.dirname(target.ilinitPath));

    steps.push({
      type: 'backup_file',
      title: `备份 ${label} 的 allegro.ilinit`,
      description: `备份到 ${backupFile}`,
      targetFile: target.ilinitPath,
      backupTo: backupFile,
    });
    steps.push({
      type: 'modify_ilinit',
      title: `写入 ${label} 的桥接加载命令`,
      description: `追加 ${loadLine}`,
      targetFile: target.ilinitPath,
      before: currentContent,
      after: nextContent,
      textEncoding,
    });
    backups.push({
      sourceFile: target.ilinitPath,
      backupFile,
      required: true,
    });
    targetFiles.push(target.ilinitPath);
  });

  if (steps.length === 0) return null;

  const risks: ApplyPlanRisk[] = [
    {
      id: 'bridge-restart-all',
      severity: 'info',
      title: '需重启 Allegro 生效',
      description: '写入后请关闭旧 Allegro，并用左下角“按此环境启动”重启；桥接会在 Allegro 启动时自动加载。',
    },
  ];

  return createApplyPlan({
    module: 'environment',
    title: '为所有 Allegro 环境启用 Vibe Bridge 自动加载',
    description: `将 vibe_server.il 加载命令写入 ${targetFiles.length} 个环境的 allegro.ilinit。`,
    steps,
    risks,
    backups,
    requiresRestart: true,
    targetFiles,
    environmentPcbenvPath: null,
    environmentId: null,
  });
}

/** 生成内置的 Vibe Bridge 服务端内容：workspace 路径硬编码，避免依赖 piport 推导导致目录不一致。 */
export function buildVibeServerTemplate(workspaceDir: string): string {
  const ws = workspaceDir.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
  return String.raw`/* vibe_server.il
 * Allegro Vibe Bridge Server (managed by ATM)
 * Polls a fixed workspace directory on a timer and writes results to vibe_out.log.
 */

(defvar vibeTimerId nil)
(defvar vibeWorkspaceDir "${ws}")

(defun vibeProcessHandler (window timerId elapsedTime)
    (let (workspaceDir inFile outFile inPort outPort code line result)

        workspaceDir = vibeWorkspaceDir
        inFile = strcat(workspaceDir "vibe_in.il")
        outFile = strcat(workspaceDir "vibe_out.log")

        (when (isFile inFile)
            (setq inPort (infile inFile))
            (setq code "")
            (while (gets line inPort)
                (setq code (strcat code line))
            )
            (close inPort)

            (when (neq code "")
                (printf "[Vibe] Received code, executing...\n")

                (let (errLog oldErrPort errMsg)
                    errLog = strcat(workspaceDir "vibe_err.log")
                    oldErrPort = errport
                    errport = (outfile errLog)

                    result = errset(
                        evalstring(strcat("let((vibeLastRes)\n" code "\n)"))
                        t
                    )

                    (close errport)
                    errport = oldErrPort

                    errMsg = ""
                    (when (isFile errLog)
                        (let (errIn line)
                            errIn = (infile errLog)
                            (while (gets line errIn)
                                errMsg = (strcat errMsg line)
                            )
                            (close errIn)
                        )
                        (deleteFile errLog)
                    )

                    (setq outPort (outfile outFile))
                    (if result
                        (fprintf outPort "SUCCESS\n%L\n" (car result))
                        (if (neq errMsg "")
                            (fprintf outPort "ERROR\n%s" errMsg)
                            (fprintf outPort "ERROR\nExecution failed. See Allegro command window for details.\n")
                        )
                    )
                    (close outPort)
                )

                (deleteFile inFile)
            )
        )
    )
)

(defun vibeStartServer ()
    (printf "Starting Vibe Polling Server using pure SKILL timer...\n")
    (when vibeTimerId
        (axlUIWTimerRemove vibeTimerId)
    )

    vibeTimerId = (axlUIWTimerAdd nil 500 nil 'vibeProcessHandler)

    (if vibeTimerId
        (printf "Vibe Polling Server started successfully. Timer ID: %L\n" vibeTimerId)
        (printf "ERROR: Failed to start Vibe Polling Server.\n")
    )
    vibeTimerId
)

(defun vibeStartOnOpen (design)
    (when(null(vibeTimerId))
        vibeStartServer()
    )
    t
)

; Start now; if the main window is not ready yet, retry automatically when a design is opened.
(when(null(vibeStartServer()))
    (when(isCallable('axlTriggerSet)
        axlTriggerSet('open 'vibeStartOnOpen)
    )
)
`;

}
/** 桥接安装结果 */
export interface VibeBridgeInstallResult {
  bridgeHome: string;
  serverFile: string;
  workspaceDir: string;
  serverCreated: boolean;
  workspaceCreated: boolean;
}

/**
 * 确保 Vibe Bridge 已就位：写入内置的 vibe_server.il（若缺失）并创建 workspace 目录。
 * 默认安装到 ~/.codex/skills/allegro-vibe-bridge，与候选探测路径保持一致。
 */
export function ensureVibeBridgeInstalled(bridgeHome?: string): VibeBridgeInstallResult {
  const home = path.normalize(
    bridgeHome ||
    candidateBridgeRoots()[0] ||
    path.join(os.homedir(), '.codex', 'skills', 'allegro-vibe-bridge'),
  );
  const serverFile = path.join(home, VIBE_SERVER_FILE);
  const workspaceDir = path.join(home, 'workspace');

  let serverCreated = false;
  if (!fs.existsSync(serverFile)) {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(serverFile, buildVibeServerTemplate(workspaceDir), { encoding: 'utf-8' });
    serverCreated = true;
  }

  let workspaceCreated = false;
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
    workspaceCreated = true;
  }

  return { bridgeHome: home, serverFile, workspaceDir, serverCreated, workspaceCreated };
}
