/**
 * ATM - Env 可视化编辑器页面组件测试
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EnvEditorPage from '../src/pages/EnvEditorPage';
import { parseEnvDocument } from '../core/env/envDocument';

const SAMPLE = [
  'funckey F1 zoom fit',
  'alias zc zoom center',
  'set path = . lib',
].join('\n');

function mockAtm() {
  const doc = parseEnvDocument(SAMPLE);
  Object.defineProperty(window, 'atm', {
    writable: true,
    configurable: true,
    value: {
      envEditorLoad: vi.fn().mockResolvedValue({
        success: true,
        data: {
          filePath: 'C:/pcbenv/env',
          encoding: 'utf8',
          contentHash: 'a'.repeat(64),
          document: doc,
        },
      }),
      envEditorPreview: vi.fn().mockResolvedValue({
        success: true,
        data: { steps: [], newContent: SAMPLE },
      }),
      envEditorApply: vi.fn().mockResolvedValue({ success: true, data: { success: true } }),
      envCompareSources: vi.fn().mockResolvedValue({
        success: true,
        data: { result: null, sources: [] },
        info: '未找到可对比的参考 env。',
      }),
    },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EnvEditorPage - 渲染', () => {
  it('应加载并渲染 env 条目', async () => {
    mockAtm();
    const { container } = render(<EnvEditorPage />);

    await waitFor(() => {
      expect(container.querySelector('.env-editor-row')).not.toBeNull();
    });

    expect(screen.getByRole('heading', { name: 'Env 编辑器' })).toBeInTheDocument();
    expect(container.querySelectorAll('.env-editor-row')).toHaveLength(3);
    expect(screen.getAllByText('快捷键').length).toBeGreaterThan(0);
    expect(screen.getAllByText('别名').length).toBeGreaterThan(0);
    expect(screen.getAllByText('变量').length).toBeGreaterThan(0);
    expect(screen.getByText('F1 → zoom fit')).toBeInTheDocument();
  });

  it('编辑条目后应出现「待应用」状态', async () => {
    mockAtm();
    const { container } = render(<EnvEditorPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.env-editor-row')).toHaveLength(3);
    });

    const editButtons = screen.getAllByRole('button', { name: '编辑' });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const keyInput = container.querySelector('.env-editor-field input') as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'F2' } });
    fireEvent.click(screen.getByRole('button', { name: '保存到草稿' }));

    await waitFor(() => {
      expect(container.querySelector('.env-editor-row.dirty')).not.toBeNull();
    });
    expect(screen.getByText('F2 → zoom fit')).toBeInTheDocument();
  });
});

describe('EnvEditorPage - 搜索与筛选', () => {
  it('关键词搜索与类型筛选应过滤条目', async () => {
    mockAtm();
    const { container } = render(<EnvEditorPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.env-editor-row')).toHaveLength(3);
    });

    const search = container.querySelector('.env-editor-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'zoom' } });
    expect(container.querySelectorAll('.env-editor-row')).toHaveLength(2);

    fireEvent.change(search, { target: { value: '' } });
    const typeSelect = container.querySelector('.env-editor-type-filter') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'variable' } });
    expect(container.querySelectorAll('.env-editor-row')).toHaveLength(1);

    fireEvent.change(search, { target: { value: 'path' } });
    expect(container.querySelectorAll('.env-editor-row')).toHaveLength(1);

    fireEvent.change(search, { target: { value: 'zzz-nomatch' } });
    expect(container.querySelectorAll('.env-editor-row')).toHaveLength(0);
    expect(screen.getByText('没有匹配的条目')).toBeInTheDocument();
  });
});

describe('EnvEditorPage - 对比参考', () => {
  it('点击「对比参考」应打开弹窗并展示差异', async () => {
    mockAtm();
    window.atm.envCompareSources = vi.fn().mockResolvedValue({
      success: true,
      data: {
        result: {
          aLabel: '用户配置 env',
          aPath: 'C:/pcbenv/env',
          bLabel: '安装默认 env',
          bPath: 'C:/Cadence/SPB_17.4/share/pcb/text/env',
          diffs: [
            { type: 'funckey', key: 'F1', aValue: 'zoom fit', bValue: 'zoom out', status: 'different' },
            { type: 'alias', key: 'zc', aValue: 'zoom center', status: 'only_a' },
          ],
          summary: { onlyA: 1, onlyB: 0, different: 1, total: 2 },
        },
        sources: [
          { id: 's1', path: 'C:/pcbenv/env', role: 'user_env', exists: true, displayName: '用户配置 env' },
          { id: 's2', path: 'C:/Cadence/SPB_17.4/share/pcb/text/env', role: 'install_default_env', exists: true, displayName: '安装默认 env' },
        ],
      },
    });
    const { container } = render(<EnvEditorPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.env-editor-row')).toHaveLength(3);
    });

    fireEvent.click(screen.getByRole('button', { name: '对比参考' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '对比参考 env' })).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.env-compare-row')).toHaveLength(2);
    expect(screen.getByText('仅在用户 1')).toBeInTheDocument();
    expect(screen.getByText('值不同 1')).toBeInTheDocument();
  });

  it('复制缺失项应把参考独有条目加入草稿', async () => {
    mockAtm();
    window.atm.envCompareSources = vi.fn().mockResolvedValue({
      success: true,
      data: {
        result: {
          aLabel: '用户配置 env',
          aPath: 'C:/pcbenv/env',
          bLabel: '安装默认 env',
          bPath: 'C:/Cadence/SPB_17.4/share/pcb/text/env',
          diffs: [
            { type: 'funckey', key: 'F5', bValue: 'add connect', status: 'only_b' },
            { type: 'alias', key: 'zv', bValue: 'zoom out', status: 'only_b' },
          ],
          summary: { onlyA: 0, onlyB: 2, different: 0, total: 2 },
        },
        sources: [
          { id: 's1', path: 'C:/pcbenv/env', role: 'user_env', exists: true, displayName: '用户配置 env' },
          { id: 's2', path: 'C:/Cadence/SPB_17.4/share/pcb/text/env', role: 'install_default_env', exists: true, displayName: '安装默认 env' },
        ],
      },
    });
    const { container } = render(<EnvEditorPage />);
    await waitFor(() => {
      expect(container.querySelectorAll('.env-editor-row')).toHaveLength(3);
    });

    fireEvent.click(screen.getByRole('button', { name: '对比参考' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '对比参考 env' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /复制缺失项/ }));
    await waitFor(() => {
      expect(container.querySelectorAll('.env-editor-row')).toHaveLength(5);
    });
    expect(screen.getByText('F5 → add connect')).toBeInTheDocument();
    expect(screen.getByText('zv → zoom out')).toBeInTheDocument();
  });
});
