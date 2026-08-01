import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ConfirmDialog from '../src/components/common/ConfirmDialog';
import MenuPreviewDialog from '../src/components/MenuPreviewDialog';

afterEach(cleanup);

function ConfirmHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>删除 Skill</button>
      <ConfirmDialog
        open={open}
        title="确认删除"
        message="此操作会生成 Apply Plan。"
        variant="danger"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

function PreviewHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开菜单预览</button>
      <MenuPreviewDialog
        open={open}
        onClose={() => setOpen(false)}
        ilContent={'println("ATM")'}
        items={[]}
      />
    </>
  );
}

describe('core dialog accessibility', () => {
  it('keeps confirmation focus inside the dialog and returns it after Escape', () => {
    render(<ConfirmHarness />);
    const trigger = screen.getByRole('button', { name: '删除 Skill' });
    trigger.focus();
    fireEvent.click(trigger);

    const cancel = screen.getByRole('button', { name: '取消' });
    const confirm = screen.getByRole('button', { name: '确认' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });

  it('closes menu preview with Escape and restores its trigger focus', () => {
    render(<PreviewHarness />);
    const trigger = screen.getByRole('button', { name: '打开菜单预览' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: '关闭菜单预览' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
});
