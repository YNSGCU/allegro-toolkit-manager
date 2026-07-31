import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  it('redirects /hotkeys to overview, renders compact tabs, and does not render page scaler wrappers', async () => {
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
      expect(container.querySelectorAll('.hotkey-subnav-link')).toHaveLength(4);
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
      expect(within(profileBar as HTMLElement).getByRole('button', { name: '更多' })).toBeInTheDocument(),
    );

    expect(within(profileBar as HTMLElement).getByRole('button', { name: '新建' })).toBeInTheDocument();
    expect(within(profileBar as HTMLElement).getByRole('button', { name: '复制' })).toBeInTheDocument();
    expect(within(profileBar as HTMLElement).getByRole('button', { name: '更多' })).toBeInTheDocument();
    expect(within(profileBar as HTMLElement).getByRole('button', { name: '当前已应用' })).toBeInTheDocument();
    expect(within(profileBar as HTMLElement).queryByRole('button', { name: '重命名' })).not.toBeInTheDocument();
    expect(within(profileBar as HTMLElement).queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
    expect(within(profileBar as HTMLElement).queryByRole('button', { name: '导入' })).not.toBeInTheDocument();
    expect(within(profileBar as HTMLElement).queryByRole('button', { name: '导出' })).not.toBeInTheDocument();
  });
});
