/**
 * ATM - 托管块生成单元测试
 * 测试场景：
 *   1. 生成新的托管块
 *   2. 替换已有托管块
 *   3. 为空绑定生成空块
 *   4. bootstrap 插入（ilinit 已有 load）
 *   5. bootstrap 不重复插入
 */
import { describe, it, expect } from 'vitest';
import {
  generateManagedEnvBlock,
  updateEnvWithManagedBlock,
  generateBootstrapLines,
  insertBootstrapToIlinit,
  hasBootstrapInIlinit,
} from '../core/generator/generateManagedEnvBlock';
import type { HotkeyBinding } from '../src/types/hotkey';

describe('generateManagedEnvBlock', () => {
  it('应生成带 ATM 标记的托管块', () => {
    const bindings: HotkeyBinding[] = [
      {
        id: '1',
        key: 'F8',
        command: 'autoFanout',
        type: 'funckey',
        bindingSource: 'atm_managed_block',
        source: 'atm_managed',
        status: 'normal',
      },
      {
        id: '2',
        key: 'zs',
        command: 'zoom selection',
        type: 'alias',
        bindingSource: 'atm_managed_block',
        source: 'atm_managed',
        status: 'normal',
      },
    ];

    const block = generateManagedEnvBlock(bindings);

    expect(block).toContain('# ===== ATM Managed Hotkeys Start =====');
    expect(block).toContain('# ===== ATM Managed Hotkeys End =====');
    expect(block).toContain('funckey F8 autoFanout');
    expect(block).toContain('alias zs zoom selection');
  });

  it('空绑定应生成带注释的空块', () => {
    const block = generateManagedEnvBlock([]);

    expect(block).toContain('# ===== ATM Managed Hotkeys Start =====');
    expect(block).toContain('# ===== ATM Managed Hotkeys End =====');
    expect(block).toContain('(empty - no managed hotkeys)');
  });

  it('应按类型分组并排序', () => {
    const bindings: HotkeyBinding[] = [
      { id: '1', key: 'F9', command: 'b', type: 'funckey', bindingSource: 'atm_managed_block', source: 'atm_managed', status: 'normal' },
      { id: '2', key: 'F8', command: 'a', type: 'funckey', bindingSource: 'atm_managed_block', source: 'atm_managed', status: 'normal' },
      { id: '3', key: 'zc', command: 'c', type: 'alias', bindingSource: 'atm_managed_block', source: 'atm_managed', status: 'normal' },
      { id: '4', key: 'zs', command: 'd', type: 'alias', bindingSource: 'atm_managed_block', source: 'atm_managed', status: 'normal' },
    ];

    const block = generateManagedEnvBlock(bindings);
    const lines = block.split('\n');

    const funckeyIndex = lines.findIndex((l) => l.startsWith('funckey'));
    const aliasIndex = lines.findIndex((l) => l.startsWith('alias'));

    // funckey 应在 alias 之前
    expect(funckeyIndex).toBeLessThan(aliasIndex);

    // funckey 应排序：F8 在 F9 前
    const f8Index = lines.findIndex((l) => l.includes('F8'));
    const f9Index = lines.findIndex((l) => l.includes('F9'));
    expect(f8Index).toBeLessThan(f9Index);
  });

  it('only writes managed or profile bindings into the managed block', () => {
    const bindings: HotkeyBinding[] = [
      {
        id: 'user-1',
        key: 'F1',
        command: 'userCommand',
        type: 'funckey',
        bindingSource: 'user_env_original',
        source: 'user_original',
        status: 'normal',
      },
      {
        id: 'profile-1',
        key: 'F2',
        command: 'profileCommand',
        type: 'funckey',
        bindingSource: 'active_profile',
        source: 'atm_managed',
        status: 'normal',
      },
    ];

    const block = generateManagedEnvBlock(bindings);

    expect(block).toContain('funckey F2 profileCommand');
    expect(block).not.toContain('funckey F1 userCommand');
  });
});

describe('updateEnvWithManagedBlock', () => {
  it('应替换 env 中已有的 ATM 托管块', () => {
    const originalContent = [
      'funckey F1 add connect',
      '# ===== ATM Managed Hotkeys Start =====',
      'funckey F8 oldCommand',
      '# ===== ATM Managed Hotkeys End =====',
      'alias s save',
    ].join('\n');

    const bindings: HotkeyBinding[] = [
      { id: '1', key: 'F8', command: 'newCommand', type: 'funckey', bindingSource: 'atm_managed_block', source: 'atm_managed', status: 'normal' },
    ];

    const newBlock = generateManagedEnvBlock(bindings);
    const updated = updateEnvWithManagedBlock(originalContent, newBlock);

    expect(updated).toContain('newCommand');
    expect(updated).not.toContain('oldCommand');
    expect(updated).toContain('funckey F1 add connect');
    expect(updated).toContain('alias s save');
  });

  it('应在没有托管块时追加新块', () => {
    const originalContent = [
      'funckey F1 add connect',
      'alias s save',
    ].join('\n');

    const bindings: HotkeyBinding[] = [
      { id: '1', key: 'F8', command: 'autoFanout', type: 'funckey', bindingSource: 'atm_managed_block', source: 'atm_managed', status: 'normal' },
    ];

    const newBlock = generateManagedEnvBlock(bindings);
    const updated = updateEnvWithManagedBlock(originalContent, newBlock);

    expect(updated).toContain('funckey F1 add connect');
    expect(updated).toContain('alias s save');
    expect(updated).toContain('ATM Managed Hotkeys Start');
    expect(updated).toContain('funckey F8 autoFanout');
    expect(updated).toContain('ATM Managed Hotkeys End');
  });

  it('应处理空文件', () => {
    const newBlock = generateManagedEnvBlock([]);
    const updated = updateEnvWithManagedBlock('', newBlock);

    expect(updated).toContain('ATM Managed Hotkeys Start');
    expect(updated).toContain('ATM Managed Hotkeys End');
  });
});

describe('generateBootstrapLines', () => {
  it('应生成正确的 bootstrap load 行', () => {
    const lines = generateBootstrapLines('D:/Cadence/SPB_Data/pcbenv/atm_generated');

    expect(lines).toContain('ATM Bootstrap Start');
    expect(lines).toContain('ATM Bootstrap End');
    expect(lines).toContain('load("D:/Cadence/SPB_Data/pcbenv/atm_generated/bootstrap.il")');
  });

  it('应转换反斜杠为正斜杠', () => {
    const lines = generateBootstrapLines('D:\\Cadence\\SPB_Data\\pcbenv\\atm_generated');

    expect(lines).toContain('load("D:/Cadence/SPB_Data/pcbenv/atm_generated/bootstrap.il")');
    expect(lines).not.toContain('\\\\');
  });
});

describe('insertBootstrapToIlinit', () => {
  it('应插入 bootstrap 到空 ilinit', () => {
    const bootstrap = generateBootstrapLines('D:/Cadence/SPB_Data/pcbenv/atm_generated');
    const result = insertBootstrapToIlinit('', bootstrap);

    expect(result).not.toBeNull();
    expect(result).toContain('ATM Bootstrap Start');
    expect(result).toContain('load("D:/Cadence/SPB_Data/pcbenv/atm_generated/bootstrap.il")');
  });

  it('应保留 ilinit 中已有非 ATM load 逻辑', () => {
    const existingContent = [
      '; Company init',
      'load("S:/PCB/Skill/company_init.il")',
      '',
    ].join('\n');

    const bootstrap = generateBootstrapLines('D:/Cadence/SPB_Data/pcbenv/atm_generated');
    const result = insertBootstrapToIlinit(existingContent, bootstrap);

    expect(result).not.toBeNull();
    expect(result).toContain('load("S:/PCB/Skill/company_init.il")');
    expect(result).toContain('ATM Bootstrap Start');
    expect(result).toContain('ATM Bootstrap End');
  });

  it('不应重复插入 bootstrap', () => {
    const existingContent = [
      'load("something.il")',
      '; ===== ATM Bootstrap Start =====',
      'load("atm_generated/bootstrap.il")',
      '; ===== ATM Bootstrap End =====',
    ].join('\n');

    const bootstrap = generateBootstrapLines('D:/Cadence/SPB_Data/pcbenv/atm_generated');
    const result = insertBootstrapToIlinit(existingContent, bootstrap);

    expect(result).toBeNull();
  });

  it('已有 bootstrap 时 hasBootstrapInIlinit 应返回 true', () => {
    const content = [
      '; ===== ATM Bootstrap Start =====',
      'load("bootstrap.il")',
      '; ===== ATM Bootstrap End =====',
    ].join('\n');

    expect(hasBootstrapInIlinit(content)).toBe(true);
  });

  it('没有 bootstrap 时 hasBootstrapInIlinit 应返回 false', () => {
    const content = [
      'load("something.il")',
      'alias s save',
    ].join('\n');

    expect(hasBootstrapInIlinit(content)).toBe(false);
  });
});
