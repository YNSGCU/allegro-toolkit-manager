import path from 'path';
import type { AllegroEnvironmentWorkspace } from '../../src/types/environment';

export interface AllegroLaunchSpec {
  executablePath: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

/**
 * 为所选 Allegro 环境构造一次性的进程环境。
 * 只影响新启动的 Allegro，不修改 Windows 全局 HOME/CDSROOT。
 */
export function buildAllegroLaunchSpec(
  environment: AllegroEnvironmentWorkspace,
  baseEnv: NodeJS.ProcessEnv = process.env,
): AllegroLaunchSpec {
  if (!environment.executablePath) {
    throw new Error('未找到 Allegro 可执行文件');
  }

  const homePath = environment.homePath || path.dirname(environment.pcbenvPath);
  if (!homePath) {
    throw new Error('未找到该 Allegro 环境对应的 HOME 目录');
  }

  return {
    executablePath: environment.executablePath,
    cwd: path.dirname(environment.executablePath),
    env: {
      ...baseEnv,
      HOME: homePath,
      ...(environment.installRoot ? { CDSROOT: environment.installRoot } : {}),
    },
  };
}
