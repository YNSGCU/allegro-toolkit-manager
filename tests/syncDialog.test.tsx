/**
 * 跨版本同步对话框组件测试（V6.4，M2/M4）
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SyncDialog from '../src/components/sync/SyncDialog';
import type { CrossVersionSyncPlan } from '../src/types/sync';

const environments = [
  { id: 'env_174', name: 'Allegro 17.4', version: '17.4', pcbenvPath: 'D:/a' },
  { id: 'env_172', name: 'Allegro 17.2', version: '17.2', pcbenvPath: 'D:/b' },
];

const plan: CrossVersionSyncPlan = {
  source: { environmentId: 'env_174', version: '17.4' },
  target: { environmentId: 'env_172', version: '17.2' },
  blocked: false,
  stats: { sync: 1, skip_ver: 1, skip_unknown: 0, keep_target: 0, user_force: 0 },
  items: [
    {
      kind: 'hotkey',
      ref: 'funckey:F2',
      command: 'save',
      decision: 'sync',
      sourceValue: { id: 'b1', key: 'F2', command: 'save', type: 'funckey' },
    },
    {
      kind: 'hotkey',
      ref: 'funckey:F3',
      command: 'high_only',
      decision: 'skip_ver',
      reason: '命令 high_only 由源环境 hi.il 提供，目标版本 17.2 无对应提供者',
      sourceValue: { id: 'b2', key: 'F3', command: 'high_only', type: 'funckey' },
    },
  ],
};

function mockAtm(overrides: Record<string, unknown> = {}) {
  const ok = (data: unknown) => ({ success: true, data });
  const base: Record<string, unknown> = {
    syncEnvironments: () => Promise.resolve(ok(environments)),
    syncCheckEnvPair: () => Promise.resolve(ok({ ok: true, issues: [], sameDirectory: false, sameVersion: false })),
    syncBuildPlan: () => Promise.resolve(ok(plan)),
    syncUpdateRule: () => Promise.resolve(ok({ store: {} })),
    syncApply: () => Promise.resolve(ok({
      plan,
      saved: [
        { kind: 'hotkey', name: '主快捷键（同步）' },
        { kind: 'skill', name: '我的 Skill（同步）' },
      ],
      targetEnvironment: { environmentId: 'env_172', version: '17.2' },
    })),
    ...overrides,
  };
  window.atm = base as unknown as typeof window.atm;
}

afterEach(cleanup);

describe('SyncDialog', () => {
  it('默认选中 17.4 → 17.2，生成差异清单后展示条目与原因', async () => {
    mockAtm();
    render(<SyncDialog open onClose={() => {}} />);

    await screen.findByRole('dialog', { name: '跨版本同步' });
    expect(screen.getByLabelText('源环境（要复制哪个版本的方案）')).toHaveValue('env_174');
    expect(screen.getByLabelText('目标环境（同步到哪个版本）')).toHaveValue('env_172');

    fireEvent.click(screen.getByRole('button', { name: '生成差异清单' }));

    await waitFor(() => {
      expect(screen.getByText(/待同步 1 项/)).toBeInTheDocument();
      expect(screen.getByText('funckey:F2')).toBeInTheDocument();
      expect(screen.getByText('funckey:F3')).toBeInTheDocument();
      expect(screen.getByText(/hi\.il 提供/)).toBeInTheDocument();
    });
  });

  it('修改决策后确认同步会把覆盖传给 syncApply 并显示结果', async () => {
    const apply = vi.fn().mockResolvedValue({
      success: true,
      data: {
        plan,
        saved: [{ kind: 'hotkey', name: '主快捷键（同步）' }],
        targetEnvironment: { environmentId: 'env_172', version: '17.2' },
      },
    });
    mockAtm({ syncApply: apply });
    render(<SyncDialog open onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: '生成差异清单' }));
    const select = await screen.findByLabelText('决策 funckey:F3');
    fireEvent.change(select, { target: { value: 'user_force' } });
    fireEvent.click(screen.getByRole('button', { name: '同步到目标环境' }));

    await waitFor(() => {
      expect(apply).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceEnvironmentId: 'env_174',
          targetEnvironmentId: 'env_172',
          decisions: [{ kind: 'hotkey', ref: 'funckey:F3', decision: 'user_force' }],
        }),
      );
    });
    expect(await screen.findByText(/主快捷键（同步）/)).toBeInTheDocument();
  });

  it('环境对校验失败时提示原因并停留在配置屏', async () => {
    mockAtm({
      syncCheckEnvPair: () => Promise.resolve({
        success: true,
        data: {
        ok: false,
        issues: ['源与目标环境指向同一 pcbenv 目录，同步会互相覆盖'],
        sameDirectory: true,
        sameVersion: false,
        },
      }),
    });
    render(<SyncDialog open onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: '生成差异清单' }));

    expect(await screen.findByText(/同一 pcbenv 目录/)).toBeInTheDocument();
    expect(screen.queryByText(/待同步/)).not.toBeInTheDocument();
  });
});
