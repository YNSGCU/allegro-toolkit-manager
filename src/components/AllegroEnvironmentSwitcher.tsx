import { useEffect, useState } from 'react';
import type { EnvironmentRegistry } from '../types/environment';
import { runEnvironmentSwitchGuards } from '../services/environmentSwitchGuard';

export default function AllegroEnvironmentSwitcher() {
  const [registry, setRegistry] = useState<EnvironmentRegistry | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');

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
    setBusy(true);
    const canSwitch = await runEnvironmentSwitchGuards();
    if (!canSwitch) {
      setBusy(false);
      return;
    }
    const result = await window.atm.setActiveAllegroEnvironment(environmentId);
    if (result.success) {
      window.location.reload();
      return;
    }
    setBusy(false);
  };

  if (!registry?.environments.length) return null;

  return (
    <div className="atm-environment-switcher">
      <label htmlFor="atm-environment-select">Allegro 管理目标</label>
      <select
        id="atm-environment-select"
        aria-label="当前 Allegro 环境"
        value={selectedEnvironmentId}
        disabled={busy}
        onChange={(event) => setSelectedEnvironmentId(event.target.value)}
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
        disabled={busy || !selectedEnvironmentId || selectedEnvironmentId === registry.activeEnvironmentId}
        aria-label="切换 Allegro 环境"
        onClick={() => void switchEnvironment()}
      >
        {busy ? '切换中…' : '切换环境'}
      </button>
      <span className="atm-environment-switch-status" role="status">
        只切换 ATM 管理目标，不启动 Allegro
      </span>
    </div>
  );
}
