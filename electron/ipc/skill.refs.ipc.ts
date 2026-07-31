/**
 * ATM - Skill 引用检查 IPC 处理器（从 skill.ipc.ts 拆分，V5.4）
 *
 * 处理：引用验证、增强引用检查、失效引用检测
 */
import { ipcMain } from 'electron';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { scanEnhancedSkills, buildEnhancedCommandList, findUnreferencedSkills } from '../../core/skill/enhancedScan';
import { validateSkillReferences } from '../../core/validator/validateSkillRefs';
import { CommandIndex } from '../../core/skill/commandIndex';
import { enrichBindings } from '../../core/validator/validateHotkeys';
import { findStaleRefs } from '../../core/skill/skillImpactAnalysis';
import type { HotkeyBinding } from '../../src/types/hotkey';
import type { SkillReferenceIssue, SkillCommandItem } from '../../src/types/skill';

function getCompanySkillPaths(): string[] {
  const paths: string[] = [];
  const cdsSite = process.env.CDS_SITE;
  const skillPath = process.env.SKILL_PATH;
  if (cdsSite) paths.push(cdsSite);
  if (skillPath) {
    const parts = skillPath.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
    paths.push(...parts);
  }
  return paths;
}

function getEnvInfoWithCompanyPaths() {
  const envInfo = locateEnvironment();
  const companySkillPaths = getCompanySkillPaths();
  return { ...envInfo, companySkillPaths };
}

export function registerSkillRefsIpc(): void {
  // V1/V2 快捷键引用校验
  ipcMain.handle('skill:validate-refs', async (_event, bindingsJson: string) => {
    try {
      const bindings: HotkeyBinding[] = JSON.parse(bindingsJson);
      const envInfo = getEnvInfoWithCompanyPaths();
      const result = validateSkillReferences(envInfo, bindings);
      return { success: true, data: { registry: result.registry, refChecks: result.refChecks } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `校验快捷键引用失败: ${message}` };
    }
  });

  // V4.5 增强引用检查
  ipcMain.handle('skill:enhanced-refs', async (_event, bindingsJson: string) => {
    try {
      const bindings: HotkeyBinding[] = JSON.parse(bindingsJson);
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const commandList = buildEnhancedCommandList(scanResult.all);
      const issues: SkillReferenceIssue[] = [];
      const allCommands = new Map<string, SkillCommandItem[]>();
      for (const cmd of commandList) {
        const key = cmd.name.toLowerCase();
        if (!allCommands.has(key)) allCommands.set(key, []);
        allCommands.get(key)!.push(cmd);
      }

      // 检查 1: 快捷键指向的命令不存在
      const { ALLEGRO_BUILTIN_COMMANDS } = require('../../core/validator/commandClassifier');
      for (const binding of bindings) {
        if (!binding.command || binding.command.trim() === '') continue;
        const rawName = binding.command.trim().split(/\s+/)[0].replace(/^["']|["']$/g, '').replace(/[;]$/, '');
        const nameLower = rawName.toLowerCase();
        if (ALLEGRO_BUILTIN_COMMANDS.has(nameLower)) continue;
        const matches = allCommands.get(nameLower);
        if (!matches || matches.length === 0) {
          issues.push({ id: `hotkey-missing-${binding.id || binding.key}`, severity: 'error', type: 'hotkey_command_missing', title: `快捷键命令不存在: ${rawName}`, description: `快捷键 "${binding.type} ${binding.key}" 指向的命令 "${rawName}" 在已扫描的 Skill 中未找到对应的函数定义。`, commandName: rawName, hotkeyKey: binding.key, suggestedActions: ['检查命令名拼写', '安装对应的 Skill 文件', '在命令注册中心手动添加来源'] });
        } else {
          for (const match of matches) {
            if (match.loadStatus === 'enabled_but_not_loaded' || match.loadStatus === 'disabled') {
              issues.push({ id: `skill-not-loaded-${binding.id || binding.key}-${match.name}`, severity: 'warning', type: 'skill_not_loaded', title: `Skill 未加载: ${match.sourceSkillName}`, description: `快捷键 "${binding.type} ${binding.key}" 指向的命令 "${rawName}" 存在于 "${match.sourceSkillName}"，但该 Skill 未配置加载，快捷键可能不可用。`, commandName: rawName, skillId: match.sourceSkillId, hotkeyKey: binding.key, suggestedActions: ['加入加载配置', '启用该 Skill', '检查 loader 配置'] });
            }
          }
        }
      }

      // 检查 2: 同名命令冲突
      for (const [name, cmds] of allCommands.entries()) {
        if (cmds.length > 1) {
          issues.push({ id: `duplicate-cmd-${name}`, severity: 'warning', type: 'duplicate_command', title: `同名命令冲突: ${name}`, description: `命令 "${name}" 在 ${cmds.length} 个 Skill 中都有定义: ${cmds.map((c) => c.sourceSkillName).join(', ')}。`, commandName: name, suggestedActions: ['检查哪些 Skill 真正需要此命令', '手动修正命令来源', '禁用多余的 Skill'], details: { matchedSkills: cmds.map((c) => c.sourceSkillName), matchedCommands: [name] } });
        }
      }

      // 检查 3: 未引用 Skill
      const unreferenced = findUnreferencedSkills(scanResult.all, bindings);
      for (const skill of unreferenced) {
        if (skill.entryCommands.length > 0 && skill.tier !== 'company') {
          issues.push({ id: `unreferenced-skill-${skill.id}`, severity: 'info', type: 'skill_unreferenced', title: `Skill 未被引用: ${skill.name}`, description: `Skill "${skill.name}" 有 ${skill.entryCommands.length} 个入口命令，但未被任何快捷键或菜单引用。`, skillId: skill.id, suggestedActions: ['添加快捷键绑定', '添加菜单入口', '如不需要可禁用'] });
        }
      }

      // 检查 4: 解析错误
      for (const skill of scanResult.all) {
        if (skill.parseStatus === 'error' && skill.parseError) {
          issues.push({ id: `parse-error-${skill.id}`, severity: 'warning', type: 'parse_error', title: `Skill 解析错误: ${skill.name}`, description: `解析 "${skill.name}" 时出错: ${skill.parseError}`, skillId: skill.id, suggestedActions: ['检查文件格式', '查看原始文件', '重新扫描'] });
        }
      }

      // V5.1 检查 5: 失效引用
      try {
        const staleRefs = findStaleRefs(bindings, scanResult.all);
        for (const stale of staleRefs) {
          issues.push({ id: `stale-ref-${stale.bindingId}`, severity: 'warning', type: 'stale_hotkey_ref', title: `失效引用: ${stale.commandName}`, description: `快捷键 "${stale.hotkeyKey}" 引用 "${stale.commandName}"，但对应的 Skill 文件 "${stale.expectedSkillName}" 已不存在。`, commandName: stale.commandName, hotkeyKey: stale.hotkeyKey, suggestedActions: ['删除快捷键绑定', '更新命令名', '重新安装对应的 Skill 文件'] });
        }
      } catch {}

      // V5.1 检查 6: 禁用 Skill 同名命令冲突
      const disabledCmdMap = new Map<string, string[]>();
      for (const skill of scanResult.all) {
        if (!skill.enabled) {
          for (const cmd of skill.entryCommands) {
            const name = cmd.name.toLowerCase();
            if (!disabledCmdMap.has(name)) disabledCmdMap.set(name, []);
            disabledCmdMap.get(name)!.push(skill.name);
          }
        }
      }
      for (const [cmdName, skillNames] of disabledCmdMap) {
        const enabledWithCmd = scanResult.all.filter((s) => s.enabled && s.entryCommands.some((c) => c.name.toLowerCase() === cmdName));
        if (enabledWithCmd.length > 0) {
          issues.push({ id: `duplicate-skill-cmd-${cmdName}`, severity: 'info', type: 'duplicate_skill_command', title: `同名命令冲突(Skill): ${cmdName}`, description: `命令 "${cmdName}" 由已禁用的 Skill 定义: ${skillNames.join(', ')}，同时由已启用的 Skill 定义: ${enabledWithCmd.map((s) => s.name).join(', ')}`, commandName: cmdName, suggestedActions: ['启用对应 Skill', '检查并删除重复定义', '忽略'], details: { matchedSkills: [...skillNames, ...enabledWithCmd.map((s) => s.name)], matchedCommands: [cmdName] } });
        }
      }

      return { success: true, data: { issues, commandList, skills: scanResult, stats: { total: issues.length, errors: issues.filter((i) => i.severity === 'error').length, warnings: issues.filter((i) => i.severity === 'warning').length, infos: issues.filter((i) => i.severity === 'info').length } } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `增强引用检查失败: ${message}` };
    }
  });

  // V5.1 失效引用检查（不带增强 refs 的轻量版）
  ipcMain.handle('skill:check-stale-refs', async (_event, bindingsJson: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const allBindings: HotkeyBinding[] = JSON.parse(bindingsJson);
      const commandIndex = new CommandIndex();
      commandIndex.build(scanResult.all);
      const enrichedBindings = enrichBindings(allBindings, commandIndex);
      const staleRefs = findStaleRefs(enrichedBindings, scanResult.all, commandIndex);
      return { success: true, data: staleRefs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `检查失效引用失败: ${message}` };
    }
  });
}
