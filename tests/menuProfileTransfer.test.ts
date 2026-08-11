import { describe, expect, it } from 'vitest';
import {
  createMenuProfilePackage,
  importMenuProfilePackage,
  parseMenuProfilePackage,
  previewMenuProfileImport,
  serializeMenuProfilePackage,
} from '../core/menu/menuProfileTransfer';
import type { MenuItemConfig, MenuProfile, MenuProfileStore } from '../src/types/menu';

const now = '2026-08-12T00:00:00.000Z';

function command(overrides: Partial<MenuItemConfig> = {}): MenuItemConfig {
  return {
    id: 'command-old',
    label: '器件对齐',
    type: 'command',
    parentId: 'root-old',
    path: ['MySkill', '器件对齐'],
    order: 0,
    command: 'align_components',
    commandSource: 'user_skill',
    sourceSkillFile: 'D:\\old-pc\\skills\\align.il',
    menuSource: 'atm_managed',
    enabled: true,
    visible: true,
    status: 'normal',
    ...overrides,
  };
}

function profile(overrides: Partial<MenuProfile> = {}): MenuProfile {
  return {
    id: 'profile-old',
    name: '我的菜单',
    enabled: true,
    items: [{
      id: 'root-old',
      label: 'MySkill',
      type: 'menu',
      path: ['MySkill'],
      order: 0,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
      status: 'normal',
      children: [command()],
    }],
    createdAt: now,
    updatedAt: now,
    sourceEnvironmentId: 'old-machine-env',
    sourceAllegroVersion: '17.4',
    ...overrides,
  };
}

function store(profiles: MenuProfile[] = []): MenuProfileStore {
  return {
    version: '2.0',
    activeProfileId: profiles[0]?.id || 'default',
    appliedProfileId: profiles[0]?.id,
    profiles,
    updatedAt: now,
  };
}

describe('菜单方案跨电脑导入导出', () => {
  it('导出便携包时保留菜单结构并去除本机 Skill 绝对路径', () => {
    const exported = createMenuProfilePackage(
      profile(),
      { environmentName: 'Allegro 17.4', allegroVersion: '17.4' },
      '0.3.4',
    );
    const content = serializeMenuProfilePackage(exported);
    const parsed = parseMenuProfilePackage(content);

    expect(parsed.format).toBe('atm-menu-profile');
    expect(parsed.package).toMatchObject({
      kind: 'atm-menu-profile',
      schemaVersion: 1,
      exportedByVersion: '0.3.4',
      source: { allegroVersion: '17.4' },
    });
    expect(parsed.package.profile.items[0].children?.[0]).toMatchObject({
      label: '器件对齐',
      command: 'align_components',
    });
    expect(parsed.package.profile.items[0].children?.[0].sourceSkillFile).toBeUndefined();
    expect(parsed.package.profile.sourceEnvironmentId).toBeUndefined();
  });

  it('导入时重新生成全部 ID、修复父子路径并作为新草稿合并', () => {
    const current = store([profile({ id: 'existing', name: '我的菜单' })]);
    const parsed = parseMenuProfilePackage(serializeMenuProfilePackage(createMenuProfilePackage(
      profile(),
      { allegroVersion: '17.4' },
    )));
    const imported = importMenuProfilePackage(current, parsed, {
      fileName: '我的菜单.atmmenu',
      targetEnvironmentId: 'new-env',
      targetAllegroVersion: '17.4',
    });
    const root = imported.profile.items[0];
    const child = root.children?.[0];

    expect(imported.profile.name).toBe('我的菜单（导入）');
    expect(imported.profile.id).not.toBe('profile-old');
    expect(root.id).not.toBe('root-old');
    expect(child?.id).not.toBe('command-old');
    expect(child?.parentId).toBe(root.id);
    expect(child?.path).toEqual(['MySkill', '器件对齐']);
    expect(child?.menuSource).toBe('imported');
    expect(child?.sourceSkillFile).toBeUndefined();
    expect(imported.store.profiles).toHaveLength(2);
    expect(imported.store.activeProfileId).toBe(imported.profile.id);
    expect(imported.store.appliedProfileId).toBe('existing');
    expect(imported.profile.targetCompatibility).toMatchObject({
      intendedEnvironmentId: 'new-env',
      intendedAllegroVersion: '17.4',
      lastVerdict: 'portable',
    });
  });

  it('从 17.4 导入 17.2 时提示英文兼容名和 Skill 文件不随包迁移', () => {
    const parsed = parseMenuProfilePackage(serializeMenuProfilePackage(createMenuProfilePackage(
      profile(),
      { allegroVersion: '17.4' },
    )));
    const preview = previewMenuProfileImport(store([]), parsed, {
      fileName: 'menu.atmmenu',
      targetAllegroVersion: '17.2',
    });

    expect(preview.compatibilityWarningCount).toBe(1);
    expect(preview.commands).toEqual(['align_components']);
    expect(preview.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('来源 Allegro 17.4'),
      expect.stringContaining('英文兼容显示名'),
      expect.stringContaining('不包含对应 Skill 文件'),
    ]));
  });

  it('兼容旧 menu_profile.json，并拒绝未知包版本和畸形菜单项', () => {
    const legacyStore = store([profile()]);
    expect(parseMenuProfilePackage(JSON.stringify(legacyStore)).format).toBe('menu-profile-store');

    expect(() => parseMenuProfilePackage(JSON.stringify({
      kind: 'atm-menu-profile', schemaVersion: 99, profile: profile(),
    }))).toThrow('不支持的菜单方案包版本');
    expect(() => parseMenuProfilePackage(JSON.stringify({
      id: 'bad', name: '坏方案', items: [null], enabled: true, createdAt: now, updatedAt: now,
    }))).toThrow('菜单项必须是 JSON 对象');
  });
});
