import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import HotkeyWorkspacePage from '../src/pages/HotkeyWorkspacePage';

function mockAtm() {
  Object.defineProperty(window, 'atm', {
    writable: true,
    value: {
      locateEnvironment: vi.fn().mockResolvedValue({
        success: true,
        data: {
          envExists: false,
          warnings: [],
          pcbenvPath: null,
          envFilePath: null,
        },
      }),
      listProfiles: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getAppliedHotkeyProfile: vi.fn().mockResolvedValue({
        success: true,
        data: { profileId: '' },
      }),
    },
  });
}

describe('hotkey workspace routing', () => {
  afterEach(() => {
    cleanup();
  });

  it('redirects /hotkeys to the key workspace, renders three task tabs, and does not render page scaler wrappers', async () => {
    mockAtm();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/hotkeys']}>
          <Routes>
            <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(container.querySelector('.hotkey-subnav-link.active')).not.toBeNull(),
      );

      expect(container.querySelector('.hotkey-subnav-track')).not.toBeNull();
      expect(container.querySelectorAll('.hotkey-subnav-link')).toHaveLength(3);
      expect(screen.getByRole('link', { name: '键位' })).toHaveClass('active');
      expect(screen.getByRole('link', { name: '列表' })).toHaveAttribute('href', '/hotkeys/list');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(container.querySelector('.hotkey-workspace-header .ui-workspace-eyebrow')).toBeNull();
      expect(container.querySelector('.hotkey-workspace-context .profile-bar--compact')).not.toBeNull();
      expect(container.querySelector('.hotkey-workspace-context .ui-status-strip')).not.toBeNull();
      expect(container.querySelector('.hotkey-workspace-stage')).toBeNull();
      expect(container.querySelector('.hotkey-workspace-page')).not.toHaveAttribute('style');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('uses a compact profile toolbar on the hotkey workspace so the keyboard area keeps its height', async () => {
    mockAtm();

    const { container } = render(
      <MemoryRouter initialEntries={['/hotkeys']}>
        <Routes>
          <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const profileBar = container.querySelector('.profile-bar--compact');
    expect(profileBar).not.toBeNull();

    await waitFor(() =>
      expect(within(profileBar as HTMLElement).getByRole('button', { name: '方案管理' })).toBeInTheDocument(),
    );

    expect(within(profileBar as HTMLElement).getByRole('button', { name: '方案管理' })).toBeInTheDocument();
    expect(within(profileBar as HTMLElement).getByRole('combobox', { name: '快捷键方案选择' })).toHaveDisplayValue('暂无方案');
    expect(within(profileBar as HTMLElement).queryByRole('button', { name: '审阅更改' })).not.toBeInTheDocument();
    expect(within(profileBar as HTMLElement).queryByRole('button', { name: '新建方案' })).not.toBeInTheDocument();
  });

  it('does not report a successful diagnosis when workspace data failed to load', async () => {
    Object.defineProperty(window, 'atm', {
      writable: true,
      value: {
        locateEnvironment: vi.fn().mockRejectedValue(new Error('window.atm bridge unavailable')),
      },
    });

    render(
      <MemoryRouter initialEntries={['/hotkeys/overview']}>
        <Routes>
          <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const status = await screen.findByLabelText('快捷键当前状态');
    expect(status).toHaveTextContent('数据加载失败');
    expect(status).toHaveTextContent('问题尚未检查');
    expect(status).not.toHaveTextContent('问题0 个');
    expect(await screen.findByRole('alert')).toHaveTextContent('加载快捷键工作区失败');
  });
});
