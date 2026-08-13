import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, PRIMARY_WORKSPACES, getDefaultWorkspaceRoute } from '../src/config/appShell';

function readPageSource(page: string): string {
  return readFileSync(new URL(page, import.meta.url), 'utf8');
}

describe('页面工作区契约', () => {
  it('保留快捷键为默认入口并维护完整导航项', () => {
    expect(getDefaultWorkspaceRoute()).toBe('/hotkeys');
    expect(APP_NAV_ITEMS.map((item) => item.key)).toEqual([
      'workspace', 'hotkeys', 'skills', 'menu', 'colors', 'drc', 'backup', 'env-editor', 'overview',
    ]);
    expect(APP_NAV_ITEMS.find((item) => item.key === 'overview')?.label).toBe('系统状态');
    expect(PRIMARY_WORKSPACES.map((item) => item.key)).toEqual(['workspace', 'hotkeys', 'skills', 'menu', 'colors', 'drc']);
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

  it('配色桥接提示使用运行时服务路径，不硬编码开发机用户目录', () => {
    const source = readPageSource('../src/pages/ColorPage.tsx');
    expect(source).not.toContain('C:/Users/89539');
    expect(source).toContain('bridgeSetup.serverFile');
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

  it('菜单页聚合草稿与 Allegro 同步状态并保留安全应用链路', () => {
    const source = readPageSource('../src/pages/MenuPage.tsx');
    expect(source).toContain("label: '草稿'");
    expect(source).toContain("label: 'Allegro'");
    expect(source).toContain('审阅并应用');
    expect(source).toContain('showApplyAction={false}');
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

  it('快捷键工作区使用可滚动内容链并统一分区标题层级', () => {
    const workspaceCss = readPageSource('../src/shared/ui/foundations/workspace.css');
    const editorSource = readPageSource('../src/components/hotkeys/HotkeyEditorPanel.tsx');
    const conflictsSource = readPageSource('../src/components/hotkeys/HotkeyConflictsPanel.tsx');
    const importExportSource = readPageSource('../src/components/hotkeys/HotkeyImportExportPanel.tsx');

    expect(workspaceCss).toMatch(
      /\.hotkey-workspace-content\s*\{[^}]*height:\s*100%;[^}]*overflow-y:\s*auto;/s,
    );
    expect(workspaceCss).toMatch(
      /\.hotkey-workspace-context\s*\{[^}]*grid-template-columns:\s*minmax\(390px, 1fr\) max-content;/s,
    );
    expect(editorSource).toContain("mode?: 'keys' | 'list'");
    expect(editorSource).toContain('className="hotkey-editor-panel-heading"');
    expect(editorSource).toContain("mode === 'keys' ? '键位' : '快捷键列表'");
    expect(editorSource).toContain('<KeyboardVisualizer');
    expect(editorSource).toContain('className="hotkey-editor-list-scroll"');
    expect(conflictsSource).toContain('<h2>冲突处理</h2>');
    expect(importExportSource).toContain('<h2>导入导出</h2>');
  });
});
