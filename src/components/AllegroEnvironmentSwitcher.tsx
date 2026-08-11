import { useEffect, useState } from 'react';
import type { EnvironmentRegistry } from '../types/environment';
import { runEnvironmentSwitchGuards } from '../services/environmentSwitchGuard';

function normalizeWindowsPath(value: string | null | undefined): string {
  return (value || '').trim().replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

export default function AllegroEnvironmentSwitcher() {
  const [registry, setRegistry] = useState<EnvironmentRegistry | null>(null);
  const [busyAction, setBusyAction] = useState<'switch' | 'launch' | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [actionStatus, setActionStatus] = useState('');

  useEffect(() => {
    if (!window.atm || typeof window.atm.listAllegroEnvironments !== 'function') return;
    void window.atm.listAllegroEnvironments(true).then((result) => {
      if (result.success && result.data) {
        setRegistry(result.data);
        setSelectedEnvironmentId(result.data.activeEnvironmentId || result.data.environments[0]?.id || '');
      }
    });
  }, []);

  const switchEnvironment = async () => {
    const environmentId = selectedEnvironmentId;
    if (!environmentId || environmentId === registry?.activeEnvironmentId) return;
    setBusyAction('switch');
    setActionStatus('');
    const canSwitch = await runEnvironmentSwitchGuards();
    if (!canSwitch) {
      setBusyAction(null);
      return;
    }
    const result = await window.atm.setActiveAllegroEnvironment(environmentId);
    if (result.success) {
      window.location.reload();
      return;
    }
    setActionStatus(result.error || '切换 Allegro 管理目标失败');
    setBusyAction(null);
  };

  if (!registry?.environments.length) return null;

  const activeEnvironment = registry.environments.find(
    (environment) => environment.id === registry.activeEnvironmentId,
  );
  const selectionIsActive = selectedEnvironmentId === registry.activeEnvironmentId;
  const hostHome = normalizeWindowsPath(registry.hostEnvironment?.homePath);
  const hostCdsRoot = normalizeWindowsPath(registry.hostEnvironment?.cdsRoot);
  const activeHome = normalizeWindowsPath(activeEnvironment?.homePath);
  const activeCdsRoot = normalizeWindowsPath(activeEnvironment?.installRoot);
  const hostEnvironmentMismatch = Boolean(activeEnvironment && (
    (hostHome && activeHome && hostHome !== activeHome)
    || (hostCdsRoot && activeCdsRoot && hostCdsRoot !== activeCdsRoot)
  ));

  const launchEnvironment = async () => {
    if (!registry.activeEnvironmentId || !selectionIsActive) return;
    setBusyAction('launch');
    setActionStatus('');
    const result = await window.atm.launchAllegroEnvironment(registry.activeEnvironmentId);
    if (result.success) {
      const version = result.data?.allegroVersion || activeEnvironment?.allegroVersion || '';
      setActionStatus(`已按独立环境启动 Allegro ${version}`.trim());
    } else {
      setActionStatus(result.error || '启动 Allegro 失败');
    }
    setBusyAction(null);
  };

  return (
    <div className="atm-environment-switcher">
      <label htmlFor="atm-environment-select">Allegro 管理目标</label>
      <select
        id="atm-environment-select"
        aria-label="当前 Allegro 环境"
        value={selectedEnvironmentId}
        disabled={busyAction !== null}
        onChange={(event) => {
          setSelectedEnvironmentId(event.target.value);
          setActionStatus('');
        }}
      >
        {registry.environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.allegroVersion ? `Allegro ${environment.allegroVersion}` : environment.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-sm atm-environment-switch"
        disabled={busyAction !== null || !selectedEnvironmentId || selectionIsActive}
        aria-label="切换 Allegro 环境"
        onClick={() => void switchEnvironment()}
      >
        {busyAction === 'switch' ? '切换中…' : '切换环境'}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-secondary atm-environment-launch"
        disabled={busyAction !== null || !registry.activeEnvironmentId || !selectionIsActive}
        aria-label="按当前环境启动 Allegro"
        onClick={() => void launchEnvironment()}
      >
        {busyAction === 'launch' ? '启动中…' : '按此环境启动'}
      </button>
      <span
        className={`atm-environment-switch-status${hostEnvironmentMismatch ? ' is-warning' : ''}`}
        role={hostEnvironmentMismatch ? 'alert' : 'status'}
      >
        {actionStatus || (selectionIsActive
          ? hostEnvironmentMismatch
            ? '系统 HOME/CDSROOT 与管理目标不一致；请关闭旧 Allegro 窗口并用上方按钮启动。'
            : '切换只改变管理目标；启动按钮会为新进程设置匹配的 HOME/CDSROOT。'
          : '请先切换管理目标，再按此环境启动 Allegro。')}
      </span>
    </div>
  );
}
