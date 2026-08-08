/**
 * ATM - IPC 处理器注册入口
 * V5.4：拆分 skill.ipc.ts 为多个子模块，分别注册
 */
import { patchIpcMainHandle } from './channelRegistry';
import { registerAppIpc } from './app.ipc';
import { registerEnvIpc } from './env.ipc';
import { registerHotkeyIpc } from './hotkey.ipc';
// Skill 相关 IPC 已拆分为子模块
import { registerSkillScanIpc } from './skill.scan.ipc';
import { registerSkillApplyIpc } from './skill.apply.ipc';
import { registerSkillRefsIpc } from './skill.refs.ipc';
import { registerSkillUsageIpc } from './skill.usage.ipc';
import { registerSkillMetaIpc } from './skillMeta.ipc';
import { registerSkillSymphonyIpc } from './skill.symphony.ipc';
import { registerHistoryIpc } from './history.ipc';
import { registerImportIpc } from './import.ipc';
import { registerMenuIpc } from './menu.ipc';
import { registerSkillProfileIpc } from './skill.profile.ipc';
import { registerColorIpc } from './color.ipc';
import { registerUpdateIpc } from './update.ipc';
import { registerBackupIpc } from './backup.ipc';
import type { UpdateService } from '../services/updateService';

export function registerIpcHandlers(updateService?: UpdateService): void {
  patchIpcMainHandle();
  // app:getRuntimeInfo 必须在最前注册，以便其他模块能检测到它
  registerAppIpc();
  registerEnvIpc();
  registerHotkeyIpc();

  // Skill 模块（拆分后各子模块各自注册自己的 handler）
  registerSkillScanIpc();
  registerSkillApplyIpc();
  registerSkillRefsIpc();
  registerSkillUsageIpc();
  registerSkillMetaIpc();
  registerSkillSymphonyIpc();

  registerHistoryIpc();
  registerImportIpc();
  registerMenuIpc();
  registerSkillProfileIpc();
  registerColorIpc();
  registerBackupIpc();
  if (updateService) registerUpdateIpc(updateService);
}
