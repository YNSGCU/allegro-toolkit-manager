import { ALLEGRO_BUILTIN_COMMANDS } from '../validator/commandClassifier';
import { buildEnhancedCommandList } from '../skill/enhancedScan';
import type { SkillFileItem, SkillTier } from '../../src/types/skill';

export interface MenuCommandChoice {
  commandName: string;
  normalizedCommandName: string;
  sourceType: 'allegro_builtin' | 'user_skill' | 'company_skill' | 'atm_managed_skill';
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;
  entryType: 'axlCmdRegister' | 'procedure' | 'defun' | 'manual';
  handlerFunction?: string;
  hotkeys?: string[];
  menuPaths?: string[];
  chineseName?: string;
  skillLoaded?: boolean;
}

function sourceTypeFromTier(tier: SkillTier): MenuCommandChoice['sourceType'] {
  if (tier === 'company') return 'company_skill';
  if (tier === 'atm') return 'atm_managed_skill';
  return 'user_skill';
}

/** 构建菜单命令选择器目录：Allegro 内置命令始终存在，再合并实时扫描的 Skill 命令。 */
export function buildMenuCommandCatalog(skills: SkillFileItem[]): MenuCommandChoice[] {
  const builtins: MenuCommandChoice[] = Array.from(ALLEGRO_BUILTIN_COMMANDS).map(commandName => ({
    commandName,
    normalizedCommandName: commandName.toLowerCase(),
    sourceType: 'allegro_builtin',
    entryType: 'manual',
    skillLoaded: true,
  }));

  const skillCommands: MenuCommandChoice[] = buildEnhancedCommandList(skills).map(command => ({
    commandName: command.name,
    normalizedCommandName: command.name.toLowerCase(),
    chineseName: command.zhName,
    sourceType: sourceTypeFromTier(command.tier),
    sourceSkillId: command.sourceSkillId,
    sourceSkillName: command.sourceSkillName,
    sourceSkillFile: command.sourceFile,
    entryType: command.commandKind === 'axl_registered' ? 'axlCmdRegister' : command.commandKind,
    handlerFunction: command.handlerFunction,
    hotkeys: command.hotkeys,
    menuPaths: command.menuPaths,
    skillLoaded: command.loadStatus === 'loaded_configured',
  }));

  return [...builtins, ...skillCommands];
}
