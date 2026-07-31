/**
 * ATM - 菜单引用检查/验证模块（V5.5）
 *
 * 检查规则：
 * 1. command_missing — 命令不存在
 * 2. skill_not_loaded — 来源 Skill 未加载
 * 3. duplicate_menu_label — 同级菜单名重复
 * 4. duplicate_command — 同命令多处存在
 * 5. readonly_source — 只读来源不可编辑
 * 6. empty_label — 标签为空
 * 7. empty_command — 命令菜单项命令为空
 * 8. invalid_parent — 父级不存在
 * 9. disabled_skill — 关联 Skill 已禁用
 */
import type {
  MenuItemConfig,
  MenuProfile,
  MenuIssue,
  MenuIssueType,
  MenuItemStatus,
} from '../../src/types/menu';

interface CommandRef {
  commandName: string;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;
  isLoaded: boolean;
}

interface SkillRef {
  id: string;
  name: string;
  file: string;
  isEnabled: boolean;
  isLoaded: boolean;
}

// ═══════════════════════════════════════════════════
// 检查函数
// ═══════════════════════════════════════════════════

let issueCounter = 0;
function nextIssueId(): string {
  return `issue_${Date.now()}_${++issueCounter}`;
}

/**
 * 验证单个菜单项
 */
export function validateMenuItem(
  item: MenuItemConfig,
  allItems: MenuItemConfig[],
  commands: CommandRef[],
  skills: SkillRef[],
  parentItems?: MenuItemConfig[],
): MenuIssue[] {
  const issues: MenuIssue[] = [];
  const siblings = parentItems || allItems.filter(i => i.parentId === item.parentId && i.id !== item.id);

  // 1. 空标签
  if (!item.label || item.label.trim() === '') {
    issues.push({
      id: nextIssueId(),
      severity: 'error',
      type: 'empty_label',
      title: '菜单标签为空',
      description: `菜单项 ${item.id} 的标签为空`,
      suggestedAction: '请输入菜单名称',
    });
  }

  // 2. 命令菜单项命令为空
  if (item.type === 'command' && (!item.command || item.command.trim() === '')) {
    issues.push({
      id: nextIssueId(),
      severity: 'warning',
      type: 'empty_command',
      title: '命令菜单项未绑定命令',
      description: `"${item.label}" 未绑定任何命令`,
      suggestedAction: '从命令选择器中选择命令',
    });
  }

  // 3. 命令存在性检查
  if (item.command && item.type === 'command') {
    const cmd = item.command.trim();
    const matched = commands.find(
      c => c.commandName.toLowerCase() === cmd.toLowerCase(),
    );
    if (!matched) {
      issues.push({
        id: nextIssueId(),
        severity: 'warning',
        type: 'command_missing',
        title: '命令不存在',
        description: `命令 "${cmd}" 在命令注册中心中未找到`,
        suggestedAction: '检查命令名称是否正确，或手动输入命令（运行前需确保命令存在）',
      });
    } else {
      // 4. Skill 加载检查
      if (matched.sourceSkillId && matched.sourceSkillName) {
        const skill = skills.find(s => s.id === matched.sourceSkillId);
        if (skill) {
          if (!skill.isEnabled) {
            issues.push({
              id: nextIssueId(),
              severity: 'warning',
              type: 'disabled_skill',
              title: '关联 Skill 已禁用',
              description: `命令 "${cmd}" 来自已禁用的 Skill "${skill.name}"`,
              suggestedAction: '启用该 Skill 或删除此菜单项',
            });
          } else if (!skill.isLoaded) {
            issues.push({
              id: nextIssueId(),
              severity: 'warning',
              type: 'skill_not_loaded',
              title: 'Skill 未配置加载',
              description: `命令 "${cmd}" 来自 Skill "${skill.name}"，但该 Skill 未配置加载`,
              suggestedAction: '在 Skill 管理中启用该 Skill',
            });
          }
        }
      }
    }
  }

  // 5. 同级菜单名重复
  const sameLabel = siblings.filter(s => s.label === item.label && s.id !== item.id);
  if (sameLabel.length > 0 && item.label) {
    issues.push({
      id: nextIssueId(),
      severity: 'warning',
      type: 'duplicate_menu_label',
      title: '同级菜单名重复',
      description: `"${item.label}" 与同级菜单项同名`,
      suggestedAction: '修改菜单名称以区分',
    });
  }

  // 6. 命令重复
  if (item.command && item.type === 'command') {
    const sameCmd = allItems.filter(
      i => i.command === item.command && i.id !== item.id && i.type === 'command',
    );
    if (sameCmd.length > 0) {
      const paths = sameCmd.map(i => i.path?.join(' > ') || i.label);
      issues.push({
        id: nextIssueId(),
        severity: 'info',
        type: 'duplicate_command',
        title: '命令重复',
        description: `命令 "${item.command}" 也在其他菜单项中使用：${paths.join('、')}`,
        suggestedAction: '确认是否为有意重复使用',
      });
    }
  }

  // 7. 只读来源
  if (item.menuSource === 'company_menu' || item.menuSource === 'allegro_default') {
    issues.push({
      id: nextIssueId(),
      severity: 'info',
      type: 'readonly_source',
      title: '只读来源菜单项',
      description: `"${item.label}" 来自 ${item.menuSource === 'company_menu' ? '公司菜单' : 'Allegro 默认菜单'}，不可直接编辑`,
      suggestedAction: '复制到 ATM 托管菜单后再编辑',
    });
  }

  // 8. 无效父级
  if (item.parentId) {
    const parentExists = allItems.some(i => i.id === item.parentId);
    if (!parentExists) {
      issues.push({
        id: nextIssueId(),
        severity: 'error',
        type: 'invalid_parent',
        title: '父级菜单不存在',
        description: `"${item.label}" 的父级菜单（${item.parentId}）不存在`,
        suggestedAction: '删除此菜单项或先创建父级菜单',
      });
    }
  }

  return issues;
}

/**
 * 验证整个 Profile
 */
export function validateProfile(
  profile: MenuProfile,
  commands: CommandRef[],
  skills: SkillRef[],
): MenuIssue[] {
  const allIssues: MenuIssue[] = [];
  const allItems = flattenMenuItems(profile.items);

  for (const item of allItems) {
    const siblings = allItems.filter(i => i.parentId === item.parentId);
    const issues = validateMenuItem(item, allItems, commands, skills, siblings);
    // 将问题关联到菜单项
    item.issues = issues;
    // 更新状态
    if (issues.some(i => i.severity === 'error')) {
      item.status = 'error';
    } else if (issues.some(i => i.severity === 'warning')) {
      item.status = 'warning';
    } else {
      item.status = 'normal';
    }
    allIssues.push(...issues);
  }

  return allIssues;
}

/**
 * 检查是否存在特定类型的问题
 */
export function hasIssue(allItems: MenuItemConfig[], type: MenuIssueType): boolean {
  return allItems.some(i => i.issues?.some(iss => iss.type === type));
}

/**
 * 获取指定类型的问题数量
 */
export function countIssuesByType(allItems: MenuItemConfig[], type: MenuIssueType): number {
  return allItems.reduce((count, i) => count + (i.issues?.filter(iss => iss.type === type).length || 0), 0);
}

/**
 * 获取指定严重程度的问题数量
 */
export function countIssuesBySeverity(allItems: MenuItemConfig[], severity: 'error' | 'warning' | 'info'): number {
  return allItems.reduce(
    (count, i) => count + (i.issues?.filter(iss => iss.severity === severity).length || 0),
    0,
  );
}

/**
 * 扁平化菜单项（且包含路径信息）
 */
function flattenMenuItems(items: MenuItemConfig[]): MenuItemConfig[] {
  const result: MenuItemConfig[] = [];
  const walk = (list: MenuItemConfig[], parentPath: string[]) => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const currentPath = [...parentPath, item.label];
      item.path = currentPath;
      item.order = i;
      result.push(item);
      if (item.children) {
        walk(item.children, currentPath);
      }
    }
  };
  walk(items, []);
  return result;
}

/**
 * 将 Skill 信息转换为验证器所需的 SkillRef 格式
 */
export function skillToRef(
  id: string,
  name: string,
  file: string,
  isEnabled: boolean,
  isLoaded: boolean,
): SkillRef {
  return { id, name, file, isEnabled, isLoaded };
}

/**
 * 将 CommandIndex 命令转换为验证器所需的 CommandRef 格式
 */
export function commandToRef(
  commandName: string,
  sourceSkillId?: string,
  sourceSkillName?: string,
  sourceSkillFile?: string,
  isLoaded: boolean = false,
): CommandRef {
  return { commandName, sourceSkillId, sourceSkillName, sourceSkillFile, isLoaded };
}
