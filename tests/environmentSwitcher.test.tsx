import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AllegroEnvironmentSwitcher from '../src/components/AllegroEnvironmentSwitcher';

afterEach(() => cleanup());

function environment(overrides: Record<string, unknown>) {
  return {
    id: 'env',
    name: 'Allegro 17.2',
    allegroVersion: '17.2',
    installRoot: 'D:\\Cadence\\SPB_17.2',
    executablePath: 'D:\\Cadence\\SPB_17.2\\tools\\bin\\allegro.exe',
    homePath: 'D:\\Cadence\\SPB_Data',
    pcbenvPath: 'D:\\Cadence\\SPB_Data\\pcbenv',
    envFilePath: 'D:\\Cadence\\SPB_Data\\pcbenv\\env',
    ilinitFilePath: 'D:\\Cadence\\SPB_Data\\pcbenv\\allegro.ilinit',
    writable: true,
    exists: true,
    sharedWithIds: [],
    source: 'discovered',
    ...overrides,
  };
}

describe('AllegroEnvironmentSwitcher', () => {
  it('刷新后每个 Allegro 版本只显示一个选项', async () => {
    const listAllegroEnvironments = vi.fn().mockResolvedValue({
      success: true,
      data: {
        version: 1,
        activeEnvironmentId: 'v174-install',
        updatedAt: new Date().toISOString(),
        environments: [
          environment({ id: 'v172-install' }),
          environment({
            id: 'v174-install',
            name: 'Allegro 17.4',
            allegroVersion: '17.4',
            installRoot: 'D:\\Cadence\\SPB_17.4',
            executablePath: 'D:\\Cadence\\SPB_17.4\\tools\\bin\\allegro.exe',
            homePath: 'D:\\Cadence174\\SPB_Data',
            pcbenvPath: 'D:\\Cadence174\\SPB_Data\\pcbenv',
          }),
        ],
      },
    });
    const setActiveAllegroEnvironment = vi.fn().mockResolvedValue({ success: false, error: '测试环境切换' });
    window.atm = {
      listAllegroEnvironments,
      setActiveAllegroEnvironment,
    } as any;

    render(<AllegroEnvironmentSwitcher />);

    expect(await screen.findByRole('option', { name: 'Allegro 17.2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Allegro 17.4' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v172-install' } });
    expect(screen.getByRole('button', { name: '切换 Allegro 环境' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '切换 Allegro 环境' }));
    await waitFor(() => expect(setActiveAllegroEnvironment).toHaveBeenCalledWith('v172-install'));
    expect(listAllegroEnvironments).toHaveBeenCalledWith(true);
  });

  it('切换按钮不会隐式启动 Allegro，但提供按活动环境隔离启动入口', async () => {
    const launchAllegroEnvironment = vi.fn().mockResolvedValue({
      success: true,
      data: {
        pid: 123,
        environmentId: 'v172-install',
        allegroVersion: '17.2',
        homePath: 'D:\\Cadence\\SPB_Data',
        executablePath: 'D:\\Cadence\\SPB_17.2\\tools\\bin\\allegro.exe',
      },
    });
    window.atm = {
      listAllegroEnvironments: vi.fn().mockResolvedValue({
        success: true,
        data: {
          version: 1,
          activeEnvironmentId: 'v172-install',
          updatedAt: new Date().toISOString(),
          environments: [environment({ id: 'v172-install' })],
        },
      }),
      setActiveAllegroEnvironment: vi.fn(),
      launchAllegroEnvironment,
    } as any;

    render(<AllegroEnvironmentSwitcher />);

    const launchButton = await screen.findByRole('button', { name: '按当前环境启动 Allegro' });
    expect(screen.getByRole('button', { name: '切换 Allegro 环境' })).toBeDisabled();
    expect(launchAllegroEnvironment).not.toHaveBeenCalled();
    fireEvent.click(launchButton);
    await waitFor(() => expect(launchAllegroEnvironment).toHaveBeenCalledWith('v172-install'));
    expect(await screen.findByText('已按独立环境启动 Allegro 17.2')).toBeInTheDocument();
  });

  it('系统 HOME 指向其他版本时显示阻断性提示', async () => {
    window.atm = {
      listAllegroEnvironments: vi.fn().mockResolvedValue({
        success: true,
        data: {
          version: 1,
          activeEnvironmentId: 'v172-install',
          updatedAt: new Date().toISOString(),
          hostEnvironment: {
            homePath: 'D:\\Cadence174\\SPB_Data',
            cdsRoot: 'D:\\Cadence174\\SPB_17.4',
          },
          environments: [environment({ id: 'v172-install' })],
        },
      }),
      setActiveAllegroEnvironment: vi.fn(),
      launchAllegroEnvironment: vi.fn(),
    } as any;

    render(<AllegroEnvironmentSwitcher />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '系统 HOME/CDSROOT 与管理目标不一致',
    );
  });
});
