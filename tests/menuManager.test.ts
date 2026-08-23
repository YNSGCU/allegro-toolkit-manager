import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ensureBootstrapMenuLoad,
  generateBootstrapMenuLoadLine,
  generateMenuIlContent,
  getMenuApplyPlanSteps,
  findMenuProfileRecovery,
  copyMenuProfileStoreFromEnvironment,
  createEmptyStore,
  loadMenuProfileStore,
  saveMenuProfileStore,
} from '../core/menu/menuManager';
import { validateMenuTree, type MenuItemConfig, type MenuProfile } from '../src/types/menu';

function menuItem(
  overrides: Partial<MenuItemConfig> & Pick<MenuItemConfig, 'id' | 'label' | 'type'>,
): MenuItemConfig {
  return {
    path: [overrides.label],
    order: 0,
    menuSource: 'atm_managed',
    enabled: true,
    visible: true,
    status: 'normal',
    ...overrides,
  };
}

function profile(items: MenuItemConfig[]): MenuProfile {
  return {
    id: 'profile-1',
    name: '中文菜单方案',
    enabled: true,
    items,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}

describe('跨 Allegro 环境复制菜单方案', () => {
  it('只复制非空方案并在目标环境创建独立草稿', () => {
    const target = createEmptyStore();
    const source = createEmptyStore();
    source.profiles = [profile([
      menuItem({ id: 'root', label: '工具', type: 'menu', children: [
        menuItem({ id: 'cmd', label: '测试命令', type: 'command', command: 'test', parentId: 'root' }),
      ] }),
    ])];
    source.activeProfileId = 'profile-1';

    const copied = copyMenuProfileStoreFromEnvironment(target, source, {
      id: 'env-174',
      version: '17.4',
      name: 'Allegro 17.4',
    });

    expect(target.profiles).toHaveLength(1);
    expect(copied.store.profiles).toHaveLength(2);
    expect(copied.store.activeProfileId).toBe(copied.profile.id);
    expect(copied.profile.name).toContain('来自 17.4');
    expect(copied.profile.sourceEnvironmentId).toBe('env-174');
    expect(copied.profile.items[0].children?.[0].command).toBe('test');
  });

  it('来源环境没有菜单项时拒绝生成空复制', () => {
    expect(() => copyMenuProfileStoreFromEnvironment(
      createEmptyStore(),
      createEmptyStore(),
      { id: 'env-empty', version: '17.2' },
    )).toThrow('来源环境没有可复制的菜单项');
  });
});

describe('菜单方案持久化', () => {
  it('原子保存后可重新加载，且不遗留临时文件', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-menu-save-'));
    try {
      const store = createEmptyStore();
      store.profiles[0].items = [menuItem({ id: 'root', label: '已保存菜单', type: 'menu' })];

      expect(saveMenuProfileStore(root, store)).toBe(true);
      expect(loadMenuProfileStore(root).profiles[0].items[0].label).toBe('已保存菜单');
      expect(fs.readdirSync(root).some(name => name.endsWith('.tmp'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('目标目录不可创建时明确返回失败', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-menu-save-fail-'));
    const blockingFile = path.join(root, 'not-a-directory');
    fs.writeFileSync(blockingFile, 'blocked', 'utf8');
    try {
      expect(saveMenuProfileStore(blockingFile, createEmptyStore())).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('generateMenuIlContent', () => {
  it('使用官方菜单触发器签名并通过 Find/Insert 构建中文菜单树', () => {
    const items = [
      menuItem({
        id: 'root',
        label: '中文工具',
        type: 'menu',
        children: [
          menuItem({
            id: 'route-menu',
            label: '布线工具',
            type: 'menu',
            parentId: 'root',
            children: [
              menuItem({
                id: 'route-command',
                label: '智能布线',
                type: 'command',
                parentId: 'route-menu',
                command: 'route smart',
              }),
              menuItem({
                id: 'separator',
                label: '分隔线',
                type: 'separator',
                parentId: 'route-menu',
              }),
            ],
          }),
        ],
      }),
    ];

    const il = generateMenuIlContent(profile(items));

    expect(il).toContain("axlTriggerSet('menu 'atmMenuOnLoad)");
    expect(il).toContain("atmAnchor = axlUIMenuFind(nil -1)");
    expect(il).toContain("atmTopMenuId = axlUIMenuInsert(atmAnchor 'popup \"中文工具\")");
    expect(il).toContain("axlUIMenuInsert(nil 'popup \"布线工具\")");
    expect(il).toContain('axlUIMenuInsert(nil "智能布线" "route smart")');
    expect(il).toContain("axlUIMenuInsert(nil 'separator)");
    expect(il).toContain("axlCmdRegister(\"atmLoadMenus\" 'atmLoadMenus ?cmdType \"general\")");
    expect(il).not.toContain('axlUIMenuRegister(');
    expect(il).not.toContain('axlTriggerSet("main" "menu"');
  });

  it('重复加载前只删除 ATM 保存的顶级菜单并重新注册回调', () => {
    const il = generateMenuIlContent(profile([
      menuItem({ id: 'root', label: 'ATM 工具', type: 'menu', children: [] }),
    ]));

    expect(il).toContain("unless(boundp('atmMenuIds)");
    expect(il).toContain('axlUIMenuDelete(atmMenuId)');
    expect(il).toContain('atmMenuIds = cons(atmTopMenuId atmMenuIds)');
    expect(il).toContain("axlTriggerClear('menu 'atmMenuOnLoad)");
    expect(il).toContain('axlCmdUnregister("atmLoadMenus")');
  });

  it('17.2 使用 ASCII 兼容显示名，但 17.4 继续生成中文标签', () => {
    const items = [menuItem({
      id: 'root',
      label: '我的工具',
      compatibilityLabel: 'My Tools',
      type: 'menu',
      children: [menuItem({
        id: 'align',
        label: '器件对齐',
        compatibilityLabel: 'Component Align',
        type: 'command',
        parentId: 'root',
        command: 'align components',
      })],
    })];

    const legacyIl = generateMenuIlContent(profile(items), { allegroVersion: '17.2 S083' });
    const modernIl = generateMenuIlContent(profile(items), { allegroVersion: '17.4' });

    expect(legacyIl).toContain("'popup \"My Tools\"");
    expect(legacyIl).toContain('"Component Align" "align components"');
    expect(legacyIl).not.toContain("'popup \"我的工具\"");
    // 17.2 生成的 IL 必须为纯 ASCII（含注释），从源头杜绝旧版 Allegro 的编码乱码
    expect([...legacyIl].filter((ch) => ch.charCodeAt(0) > 127)).toEqual([]);
    expect(modernIl).toContain("'popup \"我的工具\"");
    expect(modernIl).toContain('"器件对齐" "align components"');
  });

  it('17.2 拒绝缺失或包含非 ASCII 字符的兼容显示名', () => {
    const missing = profile([menuItem({ id: 'root', label: '中文工具', type: 'menu', children: [] })]);
    const invalid = profile([menuItem({
      id: 'root',
      label: '中文工具',
      compatibilityLabel: 'English 工具',
      type: 'menu',
      children: [],
    })]);

    expect(() => generateMenuIlContent(missing, { allegroVersion: '17.2' }))
      .toThrow('需要填写仅含英文/ASCII 的兼容显示名');
    expect(() => generateMenuIlContent(invalid, { allegroVersion: '17.2' }))
      .toThrow('需要填写仅含英文/ASCII 的兼容显示名');
  });

  it('不生成被禁用或隐藏的菜单项，并正确转义 SKILL 字符串', () => {
    const il = generateMenuIlContent(profile([
      menuItem({
        id: 'root',
        label: '工具"箱\\测试',
        type: 'menu',
        children: [
          menuItem({
            id: 'visible',
            label: '可见命令',
            type: 'command',
            command: 'echo "ok" \\done',
          }),
          menuItem({ id: 'disabled', label: '禁用命令', type: 'command', command: 'disabled', enabled: false }),
          menuItem({ id: 'hidden', label: '隐藏命令', type: 'command', command: 'hidden', visible: false }),
        ],
      }),
    ]));

    expect(il).toContain('\"工具\\\"箱\\\\测试\"');
    expect(il).toContain('\"echo \\\"ok\\\" \\\\done\"');
    expect(il).not.toContain('禁用命令');
    expect(il).not.toContain('隐藏命令');
  });

  it('拒绝超过 Allegro 菜单栈 8 层限制的菜单', () => {
    let child = menuItem({ id: 'command', label: '命令', type: 'command', command: 'save' });
    for (let depth = 9; depth >= 1; depth -= 1) {
      child = menuItem({
        id: `menu-${depth}`,
        label: `第${depth}层`,
        type: 'menu',
        children: [child],
      });
    }

    const validation = validateMenuTree([child]);

    expect(validation.errors.some(issue => issue.type === 'menu_depth_exceeded')).toBe(true);
    expect(() => generateMenuIlContent(profile([child]))).toThrow('最多支持 8 层菜单');
  });

  it('拒绝应用未绑定命令的菜单项，避免实际菜单静默缺项', () => {
    const item = menuItem({
      id: 'root',
      label: '测试',
      type: 'menu',
      children: [menuItem({ id: 'empty-command', label: '测试命令', type: 'command', command: '' })],
    });

    const validation = validateMenuTree([item]);

    expect(validation.errors.some(issue => issue.type === 'command_missing')).toBe(true);
    expect(() => generateMenuIlContent(profile([item]))).toThrow('未绑定命令');
  });
});

describe('generateBootstrapMenuLoadLine', () => {
  it('使用确定的绝对路径加载菜单，不把 getSkillPath 路径列表传给 strcat', () => {
    const line = generateBootstrapMenuLoadLine(
      'D:\\application\\Cadence\\SPB_Data\\pcbenv\\atm_generated',
    );

    expect(line).toBe(
      'load("D:/application/Cadence/SPB_Data/pcbenv/atm_generated/generated_menu.il")  ;; ATM: load menus',
    );
    expect(line).not.toContain('getSkillPath');
    expect(line).not.toContain('strcat');
  });

  it('替换已经写入 bootstrap 的旧 getSkillPath 错误行', () => {
    const updated = ensureBootstrapMenuLoad(
      'load(strcat(getSkillPath() "/atm_generated/generated_menu.il"))  ;; ATM: load menus\n',
      'D:/Cadence/SPB_Data/pcbenv/atm_generated',
    );

    expect(updated).toContain(
      'load("D:/Cadence/SPB_Data/pcbenv/atm_generated/generated_menu.il")',
    );
    expect(updated).not.toContain('getSkillPath');
    expect(updated.match(/generated_menu\.il/g)).toHaveLength(1);
  });
});

describe('getMenuApplyPlanSteps', () => {
  it('应用一个方案时写入完整方案仓库，不丢失其他方案', () => {
    const active = profile([
      menuItem({ id: 'root', label: '测试菜单', type: 'menu', children: [] }),
    ]);
    const other = { ...profile([]), id: 'default', name: '默认菜单方案' };
    const store = {
      version: '2.0',
      activeProfileId: active.id,
      profiles: [other, active],
      updatedAt: '2026-07-13T00:00:00.000Z',
    };

    const steps = getMenuApplyPlanSteps('menu_profile.json', 'generated_menu.il', active, store);
    const writtenStore = JSON.parse(steps.find(step => step.type === 'update_json')!.after!);

    expect(writtenStore.profiles.map((item: MenuProfile) => item.name)).toEqual([
      '默认菜单方案',
      active.name,
    ]);
    expect(writtenStore.activeProfileId).toBe(active.id);
    expect(writtenStore.appliedProfileId).toBe(active.id);
    expect(writtenStore.appliedAt).toBeTruthy();
  });
});

describe('findMenuProfileRecovery', () => {
  it('当前仓库为空但备份含菜单时返回最新的非空恢复候选', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-menu-recovery-'));
    try {
      const backups = path.join(root, 'backups');
      fs.mkdirSync(backups, { recursive: true });
      fs.writeFileSync(path.join(root, 'menu_profile.json'), JSON.stringify({
        version: '2.0', activeProfileId: 'default', profiles: [{ ...profile([]), id: 'default' }], updatedAt: '',
      }), 'utf8');
      const older = path.join(backups, 'menu_profile.json.100.bak');
      const newer = path.join(backups, 'menu_profile.json.200.bak');
      fs.writeFileSync(older, JSON.stringify({
        version: '2.0', activeProfileId: 'old', profiles: [{ ...profile([menuItem({ id: 'old-root', label: '旧菜单', type: 'menu' })]), id: 'old' }], updatedAt: '',
      }), 'utf8');
      fs.writeFileSync(newer, JSON.stringify({
        version: '2.0', activeProfileId: 'recovered', profiles: [{ ...profile([menuItem({ id: 'root', label: '测试菜单', type: 'menu' })]), id: 'recovered', name: '已恢复方案' }], updatedAt: '',
      }), 'utf8');
      fs.utimesSync(older, new Date(1000), new Date(1000));
      fs.utimesSync(newer, new Date(2000), new Date(2000));

      const recovery = findMenuProfileRecovery(root);
      expect(recovery?.backupPath).toBe(newer);
      expect(recovery?.activeProfile.name).toBe('已恢复方案');
      expect(recovery?.itemCount).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('当前方案已有菜单时不提供恢复候选', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-menu-recovery-current-'));
    try {
      fs.mkdirSync(path.join(root, 'backups'), { recursive: true });
      fs.writeFileSync(path.join(root, 'menu_profile.json'), JSON.stringify({
        version: '2.0', activeProfileId: 'current', profiles: [{ ...profile([menuItem({ id: 'root', label: '当前菜单', type: 'menu' })]), id: 'current' }], updatedAt: '',
      }), 'utf8');
      fs.writeFileSync(path.join(root, 'backups', 'menu_profile.json.100.bak'), JSON.stringify({
        version: '2.0', activeProfileId: 'old', profiles: [{ ...profile([menuItem({ id: 'old', label: '旧菜单', type: 'menu' })]), id: 'old' }], updatedAt: '',
      }), 'utf8');
      expect(findMenuProfileRecovery(root)).toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
