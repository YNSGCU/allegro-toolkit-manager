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
