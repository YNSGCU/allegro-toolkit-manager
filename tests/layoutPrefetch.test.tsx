import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preloadWorkspaceRoute: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/config/routePageLoaders', () => ({
  preloadWorkspaceRoute: mocks.preloadWorkspaceRoute,
}));

import Layout from '../src/components/Layout';

afterEach(() => {
  cleanup();
  mocks.preloadWorkspaceRoute.mockClear();
});

describe('workspace navigation preload', () => {
  it('preloads a page on pointer intent and keyboard focus', async () => {
    window.atm = {
      listAllegroEnvironments: vi.fn().mockResolvedValue({
        success: true,
        data: {
          version: 1,
          activeEnvironmentId: 'env-174',
          updatedAt: new Date().toISOString(),
          environments: [
            { id: 'env-174', name: 'Allegro 17.4', allegroVersion: '17.4', installRoot: 'C:\\Cadence\\SPB_17.4', executablePath: null, homePath: 'C:\\Users\\test', pcbenvPath: 'C:\\Users\\test\\pcbenv', envFilePath: 'C:\\Users\\test\\pcbenv\\env', ilinitFilePath: 'C:\\Users\\test\\pcbenv\\allegro.ilinit', writable: true, exists: true, sharedWithIds: [], source: 'discovered' },
          ],
        },
      }),
      setActiveAllegroEnvironment: vi.fn(),
    } as any;
    render(
      <MemoryRouter initialEntries={['/hotkeys']}>
        <Layout><div>当前页面</div></Layout>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('combobox', { name: '当前 Allegro 环境' })).toHaveValue('env-174');

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Skill' }));
    expect(mocks.preloadWorkspaceRoute).toHaveBeenCalledWith('/skills');

    fireEvent.focus(screen.getByRole('link', { name: '菜单' }));
    expect(mocks.preloadWorkspaceRoute).toHaveBeenCalledWith('/menu');
  });
});
