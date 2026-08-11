import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MenuProfileImportDialog from '../src/components/MenuProfileImportDialog';
import type { MenuProfileImportPreview } from '../src/types/menu';

afterEach(() => cleanup());

const preview: MenuProfileImportPreview = {
  filePath: 'D:\\transfer\\我的菜单.atmmenu',
  fileName: '我的菜单.atmmenu',
  format: 'atm-menu-profile',
  schemaVersion: 1,
  sourceProfileName: '我的菜单',
  proposedProfileName: '我的菜单（导入）',
  itemCount: 5,
  commandCount: 2,
  menuCount: 2,
  separatorCount: 1,
  sourceAllegroVersion: '17.4',
  targetAllegroVersion: '17.2',
  nameConflict: true,
  compatibilityWarningCount: 1,
  commands: ['align_components', 'cutshape'],
  warnings: ['1 个中文菜单项缺少 17.2 英文兼容显示名。'],
};

describe('MenuProfileImportDialog', () => {
  it('显示导入摘要、命令和兼容警告，再由用户进入 Apply Plan', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<MenuProfileImportDialog preview={preview} onConfirm={onConfirm} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: '导入菜单方案' })).toBeInTheDocument();
    expect(screen.getByText('我的菜单（导入）')).toBeInTheDocument();
    expect(screen.getByText('5 项（2 个菜单，2 个命令）')).toBeInTheDocument();
    expect(screen.getByText('align_components、cutshape')).toBeInTheDocument();
    expect(screen.getByText(/英文兼容显示名/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '审阅导入计划' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('生成计划时禁止关闭和重复确认', () => {
    render(<MenuProfileImportDialog preview={preview} busy onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '正在生成…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭对话框' })).toBeDisabled();
  });
});
