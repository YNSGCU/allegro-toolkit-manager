/**
 * ATM - 运行时版本信息类型定义
 *
 * 用于 main/preload/renderer 三层版本一致性检测。
 * 首次引入版本号：V5.4
 */

/** IPC 处理程序注册信息 */
export interface IpcHandlerInfo {
  channel: string;
  registered: boolean;
}

/** 运行时版本信息 */
export interface RuntimeInfo {
  /** 应用版本号（来自 package.json） */
  appVersion: string;
  /** Electron 主进程构建时间（ISO 字符串） */
  mainBuildTime: string;
  /** Preload 脚本构建时间 */
  preloadBuildTime: string;
  /** Renderer 构建时间 */
  rendererBuildTime: string;
  /** 已注册的 IPC 处理程序列表 */
  registeredIpcHandlers: IpcHandlerInfo[];
  /** Preload API 版本标识 */
  preloadApiVersion: string;
  /** 运行平台 */
  platform: string;
  /** Node.js 版本 */
  nodeVersion: string;
  /** Electron 版本 */
  electronVersion: string;
}

/** 版本一致性检查结果 */
export interface VersionCheckResult {
  /** 是否全部一致 */
  consistent: boolean;
  /** main 构建时间 */
  mainBuildTime: string;
  /** preload 构建时间（来自 main 进程检测） */
  preloadBuildTime: string;
  /** renderer 构建时间 */
  rendererBuildTime: string;
  /** 缺失的 IPC handler 列表 */
  missingHandlers: string[];
  /** 警告信息 */
  warnings: string[];
}
