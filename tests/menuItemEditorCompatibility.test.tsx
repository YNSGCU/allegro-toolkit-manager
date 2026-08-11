import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MenuItemEditor from '../src/components/MenuItemEditor';
import type { MenuItemConfig } from '../src/types/menu';

afterEach(() => cleanup());

const item: MenuItemConfig = {
  id: 'align',
  label: '器件对齐',
  type: 'command',
  command: 'align components',
  path: ['MySkill1', '器件对齐'],
  order: 0,
  menuSource: 'atm_managed',
  enabled: true,
  visible: true,
  status: 'normal',
};

function renderEditor(allegroVersion: string, onSave = vi.fn()) {
  render(
    <MenuItemEditor
      item={item}
      allegroVersion={allegroVersion}
      onSave={onSave}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onMoveUp={vi.fn()}
      onMoveDown={vi.fn()}
      onSelectCommand={vi.fn()}
    />,
  );
  return onSave;
}

describe('MenuItemEditor 17.2 兼容显示名', () => {
  it('中文标签在 17.2 下必须补充 ASCII 显示名后才能保存', () => {
    const onSave = renderEditor('17.2 S083');
    const compatibilityInput = screen.getByLabelText('17.2 英文兼容显示名（必填）');
    const unchangedButton = screen.getByRole('button', { name: '已保存' });

    expect(screen.getByText(/需要仅含英文、数字和 ASCII 符号/)).toBeInTheDocument();
    expect(unchangedButton).toBeDisabled();

    fireEvent.change(compatibilityInput, { target: { value: 'Component Align' } });
    const saveButton = screen.getByRole('button', { name: '保存修改' });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith('align', expect.objectContaining({
      label: '器件对齐',
      compatibilityLabel: 'Component Align',
    }));
  });

  it('17.4 保持中文标签，兼容显示名为可选字段', () => {
    renderEditor('17.4');

    expect(screen.getByLabelText('17.2 英文兼容显示名（可选）')).toBeInTheDocument();
    expect(screen.queryByText(/需要仅含英文、数字和 ASCII 符号/)).not.toBeInTheDocument();
  });
});
