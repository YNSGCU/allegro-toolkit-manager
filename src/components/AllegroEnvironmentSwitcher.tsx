import { useEffect, useState } from 'react';
import type { EnvironmentRegistry } from '../types/environment';

export default function AllegroEnvironmentSwitcher() {
  const [registry, setRegistry] = useState<EnvironmentRegistry | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!window.atm || typeof window.atm.listAllegroEnvironments !== 'function') return;
    void window.atm.listAllegroEnvironments().then((result) => {
      if (result.success && result.data) setRegistry(result.data);
    });
  }, []);

  const switchEnvironment = async (environmentId: string) => {
    if (!environmentId || environmentId === registry?.activeEnvironmentId) return;
    setBusy(true);
    const result = await window.atm.setActiveAllegroEnvironment(environmentId);
    if (result.success) {
      window.location.reload();
      return;
    }
    setBusy(false);
  };

  if (!registry?.environments.length) return null;

  return (
    <label className="atm-environment-switcher">
      <span>Allegro 环境</span>
      <select
        aria-label="当前 Allegro 环境"
        value={registry.activeEnvironmentId || ''}
        disabled={busy}
        onChange={(event) => void switchEnvironment(event.target.value)}
      >
        {registry.environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.allegroVersion ? `Allegro ${environment.allegroVersion}` : environment.name}
            {environment.sharedWithIds.length ? ' · 共享配置' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
