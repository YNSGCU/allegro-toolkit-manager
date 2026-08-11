import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createApplyPlan,
  executeApplyPlan,
  getChangeHistory,
  undoLastChange as undoUnifiedPlan,
} from '../core/apply/applyPlanEngine';
import {
  executeEditPlan,
  generateAddPlan,
  type EditApplyPlan,
} from '../core/apply/hotkeyEditPlan';
import { undoLastChange as undoHotkeyChange } from '../core/changeHistory/changeHistory';
import { generateSkillProfileLoader } from '../core/skill/skillProfileManager';
import { getMenuApplyPlanSteps } from '../core/menu/menuManager';
import { decodeAllegroText } from '../core/environment/allegroTextEncoding';
import { createDefaultSkillProfile } from '../src/types/skillProfile';
import type { MenuProfile, MenuProfileStore } from '../src/types/menu';

const tempDirs: string[] = [];

function createPcbenv(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('临时 pcbenv 快捷键事务', () => {
  it('写入前备份、记录历史，并可撤销到原始 env', () => {
    const pcbenv = createPcbenv('atm-hotkey-integration-');
    const envPath = path.join(pcbenv, 'env');
    const original = 'funckey F2 zoom\n';
    fs.writeFileSync(envPath, original, 'utf8');

    const plan = generateAddPlan('F12', 'slide element', 'funckey', envPath, []);
    const result = executeEditPlan(plan, envPath, []);

    expect(result.success).toBe(true);
    expect(result.backupPath && fs.readFileSync(result.backupPath, 'utf8')).toBe(original);
    expect(fs.readFileSync(envPath, 'utf8')).toContain('funckey F12 "slide element"');

    const historyFile = path.join(pcbenv, 'atm_generated', 'history', 'change_history.json');
    expect(fs.existsSync(historyFile)).toBe(true);
    expect(undoHotkeyChange(pcbenv).success).toBe(true);
    expect(fs.readFileSync(envPath, 'utf8')).toBe(original);
  });

  it('中途步骤失败时自动恢复 env，且不写成功历史', () => {
    const pcbenv = createPcbenv('atm-hotkey-rollback-');
    const envPath = path.join(pcbenv, 'env');
    const original = 'funckey F2 zoom\n';
    fs.writeFileSync(envPath, original, 'utf8');

    const plan = generateAddPlan('F12', 'zoom', 'funckey', envPath, []);
    plan.steps.push({
      opType: 'modify_env',
      target: envPath,
      description: '模拟后续步骤失败',
      before: '',
      after: 'funckey F3 broken',
      lineNumber: 999,
    });

    const result = executeEditPlan(plan as EditApplyPlan, envPath, []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('行号超出范围');
    expect(fs.readFileSync(envPath, 'utf8')).toBe(original);
    expect(fs.existsSync(path.join(pcbenv, 'atm_generated', 'history', 'change_history.json'))).toBe(false);
  });
});

describe('临时 pcbenv Skill 方案事务', () => {
  it('写入 Skill 配置与加载器，并能撤销现有文件和本次新建文件', async () => {
    const pcbenv = createPcbenv('atm-skill-integration-');
    const atmDir = path.join(pcbenv, 'atm_generated');
    const backupDir = path.join(atmDir, 'backups');
    const historyDir = path.join(atmDir, 'history');
    const profilePath = path.join(atmDir, 'skill_profiles.json');
    const loaderPath = path.join(atmDir, 'generated_skill_loader.il');
    const originalProfile = '{"version":"old"}';
    fs.mkdirSync(atmDir, { recursive: true });
    fs.writeFileSync(profilePath, originalProfile, 'utf8');

    const profile = createDefaultSkillProfile();
    profile.skillStates = [{
      skillId: 'demo',
      skillName: 'Demo Skill',
      sourceFile: path.join(pcbenv, 'skill', 'demo.il'),
      enabled: true,
      loadEnabled: true,
      order: 0,
    }];
    profile.loadOrder = ['demo'];

    const plan = createApplyPlan({
      title: '应用 Skill 方案',
      module: 'skill',
      steps: [
        {
          type: 'update_json',
          title: '更新 Skill 方案配置',
          targetFile: profilePath,
          after: JSON.stringify({ activeProfileId: profile.id, profiles: [profile] }, null, 2),
        },
        {
          type: 'write_file',
          title: '更新 Skill 加载器',
          targetFile: loaderPath,
          after: generateSkillProfileLoader(profile),
        },
      ],
    });

    const result = await executeApplyPlan(plan, { backupDir, historyDir });
    expect(result.success).toBe(true);
    expect(fs.readFileSync(profilePath, 'utf8')).toContain('Demo Skill');
    expect(fs.readFileSync(loaderPath, 'utf8')).toContain('demo.il');
    expect(plan.backups).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceFile: profilePath, existedBefore: true }),
      expect.objectContaining({ sourceFile: loaderPath, existedBefore: false }),
    ]));
    expect(getChangeHistory(historyDir)).toHaveLength(1);

    expect((await undoUnifiedPlan(historyDir, backupDir)).success).toBe(true);
    expect(fs.readFileSync(profilePath, 'utf8')).toBe(originalProfile);
    expect(fs.existsSync(loaderPath)).toBe(false);
  });

  it('物理删除步骤先备份 Skill 文件，并可从统一历史撤销', async () => {
    const pcbenv = createPcbenv('atm-skill-delete-');
    const atmDir = path.join(pcbenv, 'atm_generated');
    const skillPath = path.join(pcbenv, 'skill', 'demo.il');
    fs.mkdirSync(path.dirname(skillPath), { recursive: true });
    fs.writeFileSync(skillPath, 'procedure(demo() t)\n', 'utf8');

    const plan = createApplyPlan({
      title: '高级删除 Skill',
      module: 'skill',
      steps: [{
        type: 'delete_file',
        title: '删除 Skill 源文件',
        targetFile: skillPath,
      }],
    });
    const backupDir = path.join(atmDir, 'backups');
    const historyDir = path.join(atmDir, 'history');

    expect((await executeApplyPlan(plan, { backupDir, historyDir })).success).toBe(true);
    expect(fs.existsSync(skillPath)).toBe(false);
    expect(plan.backups[0]?.backupFile && fs.existsSync(plan.backups[0].backupFile)).toBe(true);
    expect((await undoUnifiedPlan(historyDir, backupDir)).success).toBe(true);
    expect(fs.readFileSync(skillPath, 'utf8')).toContain('procedure(demo');
  });
});

describe('临时 pcbenv 菜单方案事务', () => {
  it('17.2 菜单脚本写入 GBK 英文显示名，同时 JSON 保留中文原名', async () => {
    const pcbenv = createPcbenv('atm-menu-172-compat-');
    const atmDir = path.join(pcbenv, 'atm_generated');
    const profilePath = path.join(atmDir, 'menu_profile.json');
    const menuPath = path.join(atmDir, 'generated_menu.il');
    fs.mkdirSync(atmDir, { recursive: true });

    const now = new Date().toISOString();
    const profile: MenuProfile = {
      id: 'menu_172',
      name: '17.2 中文菜单方案',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      items: [{
        id: 'root',
        label: '中文工具',
        compatibilityLabel: 'Chinese Tools',
        type: 'menu',
        path: ['中文工具'],
        order: 0,
        menuSource: 'atm_managed',
        enabled: true,
        visible: true,
        status: 'normal',
        children: [],
      }],
    };
    const store: MenuProfileStore = {
      version: '2.0', activeProfileId: profile.id, profiles: [profile], updatedAt: now,
    };
    const plan = createApplyPlan({
      title: '应用 17.2 菜单修改',
      module: 'menu',
      steps: getMenuApplyPlanSteps(
        profilePath,
        menuPath,
        profile,
        store,
        { allegroVersion: '17.2 S083' },
      ),
      allegroTextEncoding: 'gbk',
    });

    expect((await executeApplyPlan(plan, {
      backupDir: path.join(atmDir, 'backups'),
      historyDir: path.join(atmDir, 'history'),
    })).success).toBe(true);

    const generated = decodeAllegroText(fs.readFileSync(menuPath), 'gbk');
    const persisted = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as MenuProfileStore;
    expect(generated.detectedEncoding).toBe('gbk');
    expect(generated.text).toContain("'popup \"Chinese Tools\"");
    expect(generated.text).not.toContain("'popup \"中文工具\"");
    expect(persisted.profiles[0].items[0]).toMatchObject({
      label: '中文工具',
      compatibilityLabel: 'Chinese Tools',
    });
  });

  it('使用菜单步骤生成器写入 UTF-8 脚本，失败时恢复旧配置并清理新文件', async () => {
    const pcbenv = createPcbenv('atm-menu-rollback-');
    const atmDir = path.join(pcbenv, 'atm_generated');
    const profilePath = path.join(atmDir, 'menu_profile.json');
    const menuPath = path.join(atmDir, 'generated_menu.il');
    const blockerPath = path.join(atmDir, 'not-a-directory');
    const invalidTarget = path.join(blockerPath, 'child.il');
    const originalProfile = '{"version":"old-menu"}';
    fs.mkdirSync(atmDir, { recursive: true });
    fs.writeFileSync(profilePath, originalProfile, 'utf8');
    fs.writeFileSync(blockerPath, 'block directory creation', 'utf8');

    const now = new Date().toISOString();
    const profile: MenuProfile = {
      id: 'menu_demo',
      name: '演示菜单',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      items: [{
        id: 'root',
        label: '中文工具',
        type: 'menu',
        path: ['中文工具'],
        order: 0,
        menuSource: 'atm_managed',
        enabled: true,
        visible: true,
        status: 'normal',
        children: [],
      }],
    };
    const store: MenuProfileStore = {
      version: '1.0',
      activeProfileId: profile.id,
      profiles: [profile],
      updatedAt: now,
    };
    const generatedSteps = getMenuApplyPlanSteps(profilePath, menuPath, profile, store);
    const plan = createApplyPlan({
      title: '应用菜单修改',
      module: 'menu',
      steps: [
        ...generatedSteps,
        {
          type: 'create_file',
          title: '模拟后续写入失败',
          targetFile: invalidTarget,
          after: 'failure',
        },
      ],
    });

    const result = await executeApplyPlan(plan, {
      backupDir: path.join(atmDir, 'backups'),
      historyDir: path.join(atmDir, 'history'),
    });

    expect(result.success).toBe(false);
    expect(fs.readFileSync(profilePath, 'utf8')).toBe(originalProfile);
    expect(fs.existsSync(menuPath)).toBe(false);
    expect(fs.existsSync(invalidTarget)).toBe(false);
    expect(fs.existsSync(path.join(atmDir, 'history', 'apply_plan_history.json'))).toBe(false);
  });

  it('成功生成的菜单脚本保持 UTF-8 编码并可撤销', async () => {
    const pcbenv = createPcbenv('atm-menu-integration-');
    const atmDir = path.join(pcbenv, 'atm_generated');
    const profilePath = path.join(atmDir, 'menu_profile.json');
    const menuPath = path.join(atmDir, 'generated_menu.il');
    fs.mkdirSync(atmDir, { recursive: true });
    fs.writeFileSync(profilePath, '{"version":"old"}', 'utf8');

    const now = new Date().toISOString();
    const profile: MenuProfile = {
      id: 'menu_demo',
      name: '演示菜单',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      items: [{
        id: 'root', label: '中文工具', type: 'menu', path: ['中文工具'], order: 0,
        menuSource: 'atm_managed', enabled: true, visible: true, status: 'normal', children: [],
      }],
    };
    const store: MenuProfileStore = {
      version: '1.0', activeProfileId: profile.id, profiles: [profile], updatedAt: now,
    };
    const plan = createApplyPlan({
      title: '应用菜单修改',
      module: 'menu',
      steps: getMenuApplyPlanSteps(profilePath, menuPath, profile, store),
    });
    const backupDir = path.join(atmDir, 'backups');
    const historyDir = path.join(atmDir, 'history');

    expect((await executeApplyPlan(plan, { backupDir, historyDir })).success).toBe(true);
    expect(fs.readFileSync(menuPath, 'utf8')).toContain('中文工具');
    expect((await undoUnifiedPlan(historyDir, backupDir)).success).toBe(true);
    expect(fs.existsSync(menuPath)).toBe(false);
  });
});
