import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearEnvironmentSwitchGuardsForTest,
  registerEnvironmentSwitchGuard,
} from '../src/services/environmentSwitchGuard';

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
  clearEnvironmentSwitchGuardsForTest();
});

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

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

  it('runs page leave guards before sidebar navigation', async () => {
    const guard = vi.fn().mockResolvedValue(true);
    registerEnvironmentSwitchGuard('menu-draft', guard);
    window.atm = {
      listAllegroEnvironments: vi.fn().mockResolvedValue({ success: true, data: { version: 1, activeEnvironmentId: null, updatedAt: new Date().toISOString(), environments: [] } }),
      setActiveAllegroEnvironment: vi.fn(),
    } as any;

    render(
      <MemoryRouter initialEntries={['/menu']}>
        <Layout><LocationProbe /></Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Skill' }));

    await waitFor(() => expect(guard).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/skills'));
  });

  it('blocks sidebar navigation when a page cannot save its draft', async () => {
    const guard = vi.fn().mockResolvedValue(false);
    registerEnvironmentSwitchGuard('menu-draft', guard);
    window.atm = {
      listAllegroEnvironments: vi.fn().mockResolvedValue({ success: true, data: { version: 1, activeEnvironmentId: null, updatedAt: new Date().toISOString(), environments: [] } }),
      setActiveAllegroEnvironment: vi.fn(),
    } as any;

    render(
      <MemoryRouter initialEntries={['/menu']}>
        <Layout><LocationProbe /></Layout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Skill' }));

    await waitFor(() => expect(guard).toHaveBeenCalledOnce());
    expect(screen.getByTestId('location')).toHaveTextContent('/menu');
  });
});
