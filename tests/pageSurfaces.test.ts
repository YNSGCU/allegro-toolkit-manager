import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, PRIMARY_WORKSPACES, getDefaultWorkspaceRoute } from '../src/config/appShell';

function readPageSource(page: string): string {
  return readFileSync(new URL(page, import.meta.url), 'utf8');
}

describe('页面工作区契约', () => {
  it('保留快捷键为默认入口并维持五个导航项', () => {
    expect(getDefaultWorkspaceRoute()).toBe('/hotkeys');
    expect(APP_NAV_ITEMS.map((item) => item.key)).toEqual([
      'hotkeys', 'skills', 'menu', 'overview', 'environment',
    ]);
    expect(PRIMARY_WORKSPACES.map((item) => item.key)).toEqual(['hotkeys', 'skills', 'menu']);
  });

  it('所有路由页使用共享工作区骨架，不再引用旧 Hero', () => {
    const pages = [
      '../src/pages/DashboardPage.tsx',
      '../src/pages/EnvironmentPage.tsx',
      '../src/pages/HotkeyWorkspacePage.tsx',
      '../src/pages/SkillPage.tsx',
      '../src/pages/MenuPage.tsx',
    ];

    for (const page of pages) {
      const source = readPageSource(page);
      expect(source).toContain('<WorkspacePage');
      expect(source).toContain('<WorkspaceHeader');
      expect(source).not.toContain('MinimalSurface');
      expect(source).not.toContain('CoreWorkspaceHero');
    }
  });

  it('概览展示健康、工作区和关键文件三层信息', () => {
    const source = readPageSource('../src/pages/DashboardPage.tsx');
    expect(source).toContain('workspaceEntries');
    expect(source).toContain('overview-primary-grid');
    expect(source).toContain('关键文件状态');
    expect(source).toContain('<StatusStrip');
  });

  it('环境页展示检测优先级、活动路径和变量表', () => {
    const source = readPageSource('../src/pages/EnvironmentPage.tsx');
    expect(source).toContain('environment-priority-list');
    expect(source).toContain('environment-active-list');
    expect(source).toContain('environment-var-table');
    expect(source).toContain('<PageState');
  });

  it('Skill 页保留方案、引用和列表三类操作信号', () => {
    const source = readPageSource('../src/pages/SkillPage.tsx');
    expect(source).toContain('allSkills.length');
    expect(source).toContain('userSkills.length');
    expect(source).toContain('refsChecked');
    expect(source).toContain('<GlobalStatusBar');
    expect(source).toContain('<SkillWorkspaceTable');
  });

  it('菜单页保留草稿、生成文件和 bootstrap 状态', () => {
    const source = readPageSource('../src/pages/MenuPage.tsx');
    expect(source).toContain("label: '草稿'");
    expect(source).toContain("label: '方案文件'");
    expect(source).toContain("tooltip: 'menu_profile.json'");
    expect(source).toContain("label: '菜单脚本'");
    expect(source).toContain("tooltip: 'generated_menu.il'");
    expect(source).toContain("label: '启动加载'");
    expect(source).toContain('treeValidation.hasError');
    expect(source).toContain('<MoreActionsMenu');
  });

  it('快捷键读取逻辑已从页面中抽离为独立服务', () => {
    const pageSource = readPageSource('../src/pages/HotkeyWorkspacePage.tsx');
    const serviceSource = readPageSource('../src/services/loadHotkeyWorkspaceData.ts');
    expect(pageSource).toContain("../services/loadHotkeyWorkspaceData");
    expect(serviceSource).toContain('export async function loadHotkeyWorkspaceData');
    expect(serviceSource).not.toContain('React.FC');
  });
});
