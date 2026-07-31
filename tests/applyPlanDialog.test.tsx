import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ApplyPlanDialog, { type ApplyPlanViewModel } from '../src/shared/ui/overlays/ApplyPlanDialog';

const plan: ApplyPlanViewModel = {
  id: 'plan-1',
  title: '应用 Skill 方案',
  steps: [
    { id: 'step-1', type: 'backup_file', title: '备份 loader', targetFile: 'C:/pcbenv/loader.il' },
    { id: 'step-2', type: 'write_file', title: '写入 loader', targetFile: 'C:/pcbenv/loader.il' },
  ],
  risks: [
    { id: 'risk-1', severity: 'warning', title: '需要重启', description: '重启后生效' },
  ],
  backups: [
    { sourceFile: 'loader.il', backupFile: 'loader.il.bak', required: true },
  ],
  targetFiles: ['C:/pcbenv/loader.il'],
  requiresRestart: true,
};

afterEach(cleanup);

describe('ApplyPlanDialog', () => {
  it('shows steps, risks, backups and restart state without emoji icons', () => {
    render(
      <ApplyPlanDialog
        open
        plan={plan}
        applying={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: '确认应用配置' })).toBeInTheDocument();
    expect(screen.getByText('备份 loader')).toBeInTheDocument();
    const summary = screen.getByLabelText('变更摘要');
    expect(within(summary).getByText('需要重启')).toBeInTheDocument();
    expect(within(summary).getAllByText('1')).toHaveLength(2);
    expect(document.querySelectorAll('.ui-apply-plan-dialog svg').length).toBeGreaterThan(0);
  });

  it('supports confirm and escape cancellation', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ApplyPlanDialog
        open
        plan={plan}
        applying={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '确认写入并应用' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
