import type { HotkeyProfile } from '../../src/types/hotkey';
import type { AllegroEnvironmentWorkspace, CompatibilityFinding, ProfileCompatibilityReport } from '../../src/types/environment';

function isComplexCommand(command: string): boolean {
  return /;|\bFORM\b|prepopup|axl[A-Z]|skill\s*\(|axlSet/i.test(command);
}

function hasAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]|^\\\\|^\//.test(value);
}

export function checkHotkeyProfileCompatibility(
  profile: Pick<HotkeyProfile, 'bindings' | 'sourceAllegroVersion' | 'sourceEnvironmentId'>,
  target: Pick<AllegroEnvironmentWorkspace, 'id' | 'allegroVersion' | 'pcbenvPath' | 'sharedWithIds'>,
): ProfileCompatibilityReport {
  const findings: CompatibilityFinding[] = [];
  const sourceVersion = profile.sourceAllegroVersion ?? null;
  const targetVersion = target.allegroVersion ?? null;

  if (sourceVersion && targetVersion && sourceVersion !== targetVersion) {
    findings.push({
      severity: 'warning',
      code: 'version-diff',
      title: '来源与目标 Allegro 版本不同',
      description: `方案来源于 Allegro ${sourceVersion}，目标为 Allegro ${targetVersion}，复杂命令需要在目标版本验证。`,
    });
  }

  const complexCount = profile.bindings.filter((binding) => isComplexCommand(binding.command)).length;
  if (complexCount > 0) {
    findings.push({
      severity: 'warning',
      code: 'complex-command',
      title: '包含复杂 Allegro 命令',
      description: `发现 ${complexCount} 条包含模式切换、FORM 或 SKILL 调用的命令，不能仅凭文本判断跨版本兼容。`,
    });
  }

  const pathBindings = profile.bindings.filter((binding) => hasAbsolutePath(binding.command) || hasAbsolutePath(binding.note || ''));
  if (pathBindings.length > 0) {
    findings.push({
      severity: 'error',
      code: 'absolute-path',
      title: '方案包含绝对路径',
      description: `发现 ${pathBindings.length} 条绑定包含绝对路径，迁移到其他安装或用户目录前必须改写路径。`,
    });
  }

  if (target.sharedWithIds.length > 0) {
    findings.push({
      severity: 'warning',
      code: 'shared-pcbenv',
      title: '目标配置被多个 Allegro 版本共享',
      description: '应用后其他共享同一 pcbenv 的 Allegro 版本也会看到这些修改。',
    });
  }

  if (profile.sourceEnvironmentId && profile.sourceEnvironmentId === target.id) {
    findings.push({ severity: 'info', code: 'same-environment', title: '目标就是来源环境', description: '无需执行跨版本迁移。' });
  }

  const verdict = findings.some((finding) => finding.severity === 'error')
    ? 'blocked'
    : findings.some((finding) => finding.severity === 'warning')
      ? 'warning'
      : 'portable';
  return { sourceVersion, targetVersion, verdict, findings };
}
