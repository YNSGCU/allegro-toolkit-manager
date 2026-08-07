import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AddHotkeyDialog from '../src/components/AddHotkeyDialog';
import CommandSelector from '../src/components/CommandSelector';
import HotkeyEditor from '../src/components/HotkeyEditor';
import SkillDeleteImpactDialog from '../src/components/SkillDeleteImpactDialog';
import SkillMetaDialog from '../src/components/SkillMetaDialog';

afterEach(cleanup);

describe('business dialog experience', () => {
  it('uses a labelled compact form when adding a hotkey', () => {
    const onConfirm = vi.fn();
    render(<AddHotkeyDialog physicalKey="F8" onClose={() => {}} onConfirm={onConfirm} />);

    expect(screen.getByRole('dialog', { name: /新增绑定.*物理键 F8/ })).toHaveClass('ui-business-dialog--sm');
    expect(screen.getByLabelText('原始命令')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('原始命令'), { target: { value: 'zoom fit' } });
    fireEvent.click(screen.getByRole('button', { name: '生成 Apply Plan' }));

    expect(onConfirm).toHaveBeenCalledWith({ key: 'f8', command: 'zoom fit', type: 'funckey' });
    expect(document.querySelector('.modal-overlay')).not.toBeInTheDocument();
  });

  it('suggests move when adding M and blocks an occupied layer', async () => {
    const onConfirm = vi.fn();
    const { unmount } = render(
      <AddHotkeyDialog physicalKey="M" onClose={() => {}} onConfirm={onConfirm} />,
    );

    const moveOption = await screen.findByRole('option', { name: /move.*移动/ });
    fireEvent.click(moveOption);
    expect(screen.getByLabelText('原始命令')).toHaveValue('move');
    fireEvent.click(screen.getByRole('button', { name: '生成 Apply Plan' }));
    expect(onConfirm).toHaveBeenCalledWith({ key: 'm', command: 'move', type: 'funckey' });
    unmount();

    render(
      <AddHotkeyDialog
        physicalKey="M"
        currentBindings={[{
          id: 'occupied-m',
          key: 'm',
          command: 'mirror',
          type: 'funckey',
          bindingSource: 'user_env_original',
          status: 'normal',
        }]}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('已绑定到“mirror”');
    expect(screen.getByRole('button', { name: '生成 Apply Plan' })).toBeDisabled();
  });

  it('keeps skill metadata errors announced and the form available for retry', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('保存失败，请重试'));
    render(
      <SkillMetaDialog
        skillName="route_tool"
        skillId="skill-1"
        meta={null}
        onSave={onSave}
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText('中文名称')).toHaveFocus();
    fireEvent.change(screen.getByLabelText('中文名称'), { target: { value: '走线工具' } });
    fireEvent.click(screen.getByRole('button', { name: '保存信息' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请重试');
    expect(screen.getByRole('button', { name: '保存信息' })).toBeEnabled();
  });

  it('presents skill impact choices as a keyboard-accessible radio group', () => {
    const onConfirm = vi.fn();
    render(
      <SkillDeleteImpactDialog
        skill={{ entryCommands: [{ name: 'routeCmd' }] } as any}
        impact={{
          skillName: 'route_tool',
          totalRefs: 1,
          isReadonly: false,
          hotkeyRefs: [{ key: 'F8', command: 'routeCmd', source: 'pcbenv', lineNumber: 12 }],
          menuRefs: [],
          options: [
            {
              action: 'just_disable_loader',
              label: '仅禁用加载',
              description: '保留文件并停止自动加载',
              riskLevel: 'safe',
              steps: ['更新 loader'],
            },
            {
              action: 'advanced_delete',
              label: '彻底删除',
              description: '删除 Skill 文件',
              riskLevel: 'danger',
              steps: ['备份文件', '删除文件'],
            },
          ],
        } as any}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    fireEvent.click(screen.getByRole('radio', { name: /彻底删除/ }));
    fireEvent.click(screen.getByRole('button', { name: '确认处理方式' }));
    expect(onConfirm).toHaveBeenCalledWith('advanced_delete');
  });

  it('supports searching and keyboard selection in the menu command dialog', () => {
    const onSelect = vi.fn();
    render(
      <CommandSelector
        open
        onClose={() => {}}
        onSelect={onSelect}
        commands={[
          { commandName: 'move', chineseName: '移动', sourceType: 'allegro_builtin' },
          { commandName: 'zoom fit', chineseName: '适合窗口', sourceType: 'user_skill' },
        ]}
      />,
    );

    const search = screen.getByLabelText('搜索命令');
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: 'zoom' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ command: 'zoom fit' }));
  });

  it('moves focus directly to the editable key in the hotkey editor', async () => {
    render(
      <HotkeyEditor
        binding={{
          id: 'binding-1',
          type: 'funckey',
          key: 'F8',
          command: 'zoom fit',
          enabled: true,
          bindingSource: 'env',
        } as any}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('按键 / 别名')).toHaveFocus());
    expect(screen.getByRole('dialog', { name: '编辑快捷键 · F8' })).toHaveClass('ui-business-dialog--lg');
  });
});
