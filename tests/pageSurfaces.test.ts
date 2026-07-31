import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APP_NAV_ITEMS,
  PRIMARY_WORKSPACES,
  getDefaultWorkspaceRoute,
} from '../src/config/appShell';
import {
  PAGE_SURFACES,
  getPageSurface,
  getPrimaryWorkspaceSurfaces,
} from '../src/config/pageSurfaces';

function readPageSource(page: string): string {
  return readFileSync(new URL(page, import.meta.url), 'utf8');
}

describe('page surfaces', () => {
  it('keeps hotkeys as the default route', () => {
    expect(getDefaultWorkspaceRoute()).toBe('/hotkeys');
  });

  it('defines the minimal surface copy for hotkeys', () => {
    expect(getPageSurface('hotkeys').title).toBe('快捷键工作台');
    expect(getPageSurface('hotkeys').actions.map((item) => item.id)).toEqual([
      'editor',
      'conflicts',
      'import-export',
    ]);
  });

  it('defines all five page surface entries in nav order', () => {
    expect(Object.keys(PAGE_SURFACES)).toEqual([
      'hotkeys',
      'skills',
      'menu',
      'overview',
      'environment',
    ]);
  });

  it('keeps every navigation item backed by a surface config', () => {
    expect(APP_NAV_ITEMS.map((item) => item.key)).toEqual(Object.keys(PAGE_SURFACES));
  });

  it('binds the core workspace surfaces to PRIMARY_WORKSPACES', () => {
    expect(getPrimaryWorkspaceSurfaces().map((surface) => surface.key)).toEqual(
      PRIMARY_WORKSPACES.map((item) => item.key),
    );
    expect(PRIMARY_WORKSPACES.map((item) => item.key)).toEqual([
      'hotkeys',
      'skills',
      'menu',
    ]);
  });

  it('marks hotkeys as the default entry in the overview surface actions', () => {
    const action = getPageSurface('overview').actions.find(
      (item) => item.id === 'hotkeys',
    );

    expect(action?.meta).toContain('默认');
  });
  it('keeps quick-entry cards for skills and menu pages', () => {
    expect(getPageSurface('skills').actions.map((item) => item.id)).toEqual([
      'scan',
      'refs',
      'registry',
    ]);
    expect(getPageSurface('menu').actions.map((item) => item.id)).toEqual([
      'tree',
      'commands',
      'preview',
    ]);
  });

  it('uses prompt-first action ids for overview and environment helper pages', () => {
    expect(getPageSurface('overview').actions.map((item) => item.id)).toEqual([
      'health',
      'hotkeys',
      'skills',
    ]);
    expect(getPageSurface('environment').actions.map((item) => item.id)).toEqual([
      'pcbenv',
      'scan',
      'vars',
    ]);
  });

  it('keeps helper pages on MinimalSurface while dense workspaces use compact headers', () => {
    const pages = [
      '../src/pages/DashboardPage.tsx',
      '../src/pages/EnvironmentPage.tsx',
    ];

    for (const page of pages) {
      const source = readPageSource(page);
      expect(source).toContain('MinimalSurface');
      expect(source).not.toContain('CoreWorkspaceHero');
    }

    const menuSource = readPageSource('../src/pages/MenuPage.tsx');
    const skillSource = readPageSource('../src/pages/SkillPage.tsx');
    expect(menuSource).toContain('className="menu-page-header"');
    expect(menuSource).not.toContain('<MinimalSurface');
    expect(skillSource).toContain('className="skill-workspace-header"');
    expect(skillSource).not.toContain('<MinimalSurface');
  });

  it('keeps shared surface data while allowing the dense menu editor to omit duplicate cards', () => {
    const skillSource = readPageSource('../src/pages/SkillPage.tsx');
    const menuSource = readPageSource('../src/pages/MenuPage.tsx');
    const dashboardSource = readPageSource('../src/pages/DashboardPage.tsx');
    const environmentSource = readPageSource('../src/pages/EnvironmentPage.tsx');

    for (const source of [dashboardSource, environmentSource]) {
      expect(source).toContain('const ');
      expect(source).toContain('Surface = getPageSurface(');
      expect(source).toContain('SummaryLine = [');
      expect(source).toContain('title={');
      expect(source).toContain('subtitle={');
      expect(source).toContain('prompt={');
      expect(source).toContain('summaryLine={');
      expect(source).toContain('cards={');
      expect(source).toContain('.actions.map((action) => ({');
    }

    expect(skillSource).toContain('className="skill-workspace-header"');
    expect(skillSource).toContain('<GlobalStatusBar');
    expect(skillSource).toContain('<SkillWorkspaceTable');
    expect(skillSource).toContain("label: '引用检查'");

    expect(menuSource).toContain('className="menu-page-header"');
    expect(menuSource).toContain('应用到 Allegro');
    expect(menuSource).toContain('<GlobalStatusBar');
    expect(menuSource).not.toContain('<MinimalSurface');
  });

  it('keeps the Skill workspace compact, scrollable, and free of decorative avatars', () => {
    const pageSource = readPageSource('../src/pages/SkillPage.tsx');
    const detailSource = readPageSource('../src/components/SkillDetailSidebar.tsx');

    expect(pageSource).toContain('<ProfileBar\n          compact');
    expect(pageSource).toContain('className="skill-list-area"');
    expect(detailSource).not.toContain('🤖');
    expect(detailSource).not.toContain('skill-card-icon');
  });

  it('keeps menu operating signals visible in the compact status bar', () => {
    const source = readPageSource('../src/pages/MenuPage.tsx');

    expect(source).toContain("label: '草稿'");
    expect(source).toContain("label: 'menu_profile'");
    expect(source).toContain("label: 'generated_menu.il'");
    expect(source).toContain("label: 'bootstrap'");
    expect(source).toContain('treeValidation.hasError');
    expect(source).toContain("severity === 'warning'");
    expect(source).toContain('fileStatus?.ilExists');
  });

  it('keeps page-specific operating signals visible in headers and status surfaces', () => {
    const skillSource = readPageSource('../src/pages/SkillPage.tsx');
    const menuSource = readPageSource('../src/pages/MenuPage.tsx');
    const dashboardSource = readPageSource('../src/pages/DashboardPage.tsx');
    const environmentSource = readPageSource('../src/pages/EnvironmentPage.tsx');

    expect(skillSource).toContain('allSkills.length');
    expect(skillSource).toContain('userSkills.length');
    expect(skillSource).toContain('refsChecked');
    expect(skillSource).toContain("'尚未检查'");
    expect(skillSource).toContain("'检查通过'");
    expect(skillSource).not.toContain('activeSkillProfile?.name ||');

    expect(menuSource).toContain('items.length');
    expect(menuSource).toContain('hasUnsavedChanges');

    expect(dashboardSource).toContain('health ?');
    expect(dashboardSource).toContain('envInfo?.envExists');
    expect(dashboardSource).toContain('envInfo?.pcbenvPath');

    expect(environmentSource).toContain('getDetectionModeText(envInfo.detectedMode)');
    expect(environmentSource).toContain('envInfo?.envExists');
    expect(environmentSource).toContain('envInfo?.pcbenvExists');
  });
});
