/**
 * 工作区方案导入/导出模块测试
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applyWorkspaceImport,
  buildWorkspaceExportFileName,
  buildWorkspaceExportPackage,
  parseWorkspaceExportPackage,
  previewWorkspaceImport,
  serializeWorkspaceExportPackage,
} from '../core/workspace/workspaceImportExport';
import { loadWorkspaceStore } from '../core/workspace/workspaceManager';
import type { WorkspaceProfile } from '../src/types/workspaceProfile';

const sampleWorkspace: WorkspaceProfile = {
  id: 'ws_test_1',
  name: '项目A 4DDR3',
  description: '高速板开发环境',
  environmentId: 'env_17_2',
  hotkeyProfileId: 'hk-main',
  skillProfileId: 'skill-main',
  menuProfileId: 'menu-main',
  colorSchemeId: 'scheme-dark',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

let configHome: string;
let oldConfigHome: string | undefined;

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-ws-test-'));
  oldConfigHome = process.env.ATM_CONFIG_HOME;
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  fs.rmSync(configHome, { recursive: true, force: true });
  if (oldConfigHome === undefined) delete process.env.ATM_CONFIG_HOME;
  else process.env.ATM_CONFIG_HOME = oldConfigHome;
});

describe('buildWorkspaceExportPackage', () => {
  it('只导出组合关系，不包含 id / 时间戳', () => {
    const pkg = buildWorkspaceExportPackage(sampleWorkspace);
    expect(pkg.app).toBe('atm');
    expect(pkg.type).toBe('workspace-profile');
    expect(pkg.version).toBe('1.0');
    expect(pkg.workspace.name).toBe('项目A 4DDR3');
    expect(pkg.workspace.hotkeyProfileId).toBe('hk-main');
    expect(pkg.workspace).not.toHaveProperty('id');
    expect(pkg.workspace).not.toHaveProperty('createdAt');
  });

  it('序列化后可重新解析，内容一致', () => {
    const pkg = buildWorkspaceExportPackage(sampleWorkspace);
    const restored = parseWorkspaceExportPackage(serializeWorkspaceExportPackage(pkg));
    expect(restored.workspace).toEqual(pkg.workspace);
  });
});

describe('parseWorkspaceExportPackage', () => {
  it('拒绝非 JSON 文本', () => {
    expect(() => parseWorkspaceExportPackage('not json')).toThrow(/JSON/);
  });

  it('拒绝缺少 ATM 类型标识的文件', () => {
    expect(() => parseWorkspaceExportPackage(JSON.stringify({ foo: 1 }))).toThrow(/工作区方案文件/);
  });

  it('拒绝缺少名称的工作区', () => {
    expect(() =>
      parseWorkspaceExportPackage(JSON.stringify({ app: 'atm', type: 'workspace-profile', workspace: {} })),
    ).toThrow(/名称/);
  });

  it('规范化字段：空字符串绑定转空串，可选 ID 为 undefined', () => {
    const pkg = parseWorkspaceExportPackage(JSON.stringify({
      app: 'atm',
      type: 'workspace-profile',
      workspace: {
        name: ' 测试 ',
        environmentId: '',
        hotkeyProfileId: '  hk-1  ',
        skillProfileId: '',
        menuProfileId: '',
        colorSchemeId: '  ',
      },
    }));
    expect(pkg.workspace.name).toBe('测试');
    expect(pkg.workspace.environmentId).toBeUndefined();
    expect(pkg.workspace.hotkeyProfileId).toBe('hk-1');
    expect(pkg.workspace.colorSchemeId).toBeUndefined();
  });
});

describe('previewWorkspaceImport', () => {
  it('生成预览摘要并携带文件路径', () => {
    const pkg = buildWorkspaceExportPackage(sampleWorkspace);
    const preview = previewWorkspaceImport(pkg, 'D:\\share\\workspace.json');
    expect(preview.filePath).toBe('D:\\share\\workspace.json');
    expect(preview.fileName).toBe('workspace.json');
    expect(preview.name).toBe('项目A 4DDR3');
    expect(preview.hasHotkeyProfile).toBe(true);
    expect(preview.hasMenuProfile).toBe(true);
    expect(preview.hasColorScheme).toBe(true);
  });
});

describe('applyWorkspaceImport', () => {
  it('以新 ID 创建工作区并保留绑定', () => {
    const pkg = buildWorkspaceExportPackage(sampleWorkspace);
    const created = applyWorkspaceImport(pkg);
    expect(created.id).not.toBe(sampleWorkspace.id);
    expect(created.name).toBe('项目A 4DDR3');
    expect(created.hotkeyProfileId).toBe('hk-main');
    expect(created.menuProfileId).toBe('menu-main');

    const store = loadWorkspaceStore();
    expect(store.workspaces.some((item) => item.id === created.id)).toBe(true);
  });

  it('名称重名时自动追加「（导入）」', () => {
    applyWorkspaceImport(buildWorkspaceExportPackage(sampleWorkspace));
    const second = applyWorkspaceImport(buildWorkspaceExportPackage(sampleWorkspace));
    expect(second.name).toBe('项目A 4DDR3（导入）');
  });

  it('支持调用方覆盖名称', () => {
    const created = applyWorkspaceImport(buildWorkspaceExportPackage(sampleWorkspace), '自定义名称');
    expect(created.name).toBe('自定义名称');
  });
});

describe('buildWorkspaceExportFileName', () => {
  it('清理非法文件名字符并限制长度', () => {
    const fileName = buildWorkspaceExportFileName('测试: 工作区/方案?');
    expect(fileName).toContain('.atm-workspace.json');
    expect(fileName).not.toMatch(/[:/]/);
  });

  it('空名称回退为「工作区」', () => {
    expect(buildWorkspaceExportFileName('   ')).toBe('工作区.atm-workspace.json');
  });
});
