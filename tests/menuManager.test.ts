import { describe, expect, it } from 'vitest';
import {
  ensureBootstrapMenuLoad,
  generateBootstrapMenuLoadLine,
  generateMenuIlContent,
  getMenuApplyPlanSteps,
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
      'load("D:/application/Cadence/SPB_Data/pcbenv/atm_generated/generated_menu.il")  ;; ATM: 加载菜单',
    );
    expect(line).not.toContain('getSkillPath');
    expect(line).not.toContain('strcat');
  });

  it('替换已经写入 bootstrap 的旧 getSkillPath 错误行', () => {
    const updated = ensureBootstrapMenuLoad(
      'load(strcat(getSkillPath() "/atm_generated/generated_menu.il"))  ;; ATM: 加载菜单\n',
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
