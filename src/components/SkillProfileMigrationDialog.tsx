/**
 * ATM - Skill 方案跨版本迁移弹窗
 */
import { useEffect, useMemo, useState } from 'react';
import type { EnvironmentRegistry, ProfileCompatibilityReport } from '../types/environment';
import type { SkillProfile } from '../types/skillProfile';

interface Props {
  profile: SkillProfile;
  onClose: () => void;
  onMigrated: (message: string) => void;
}

export default function SkillProfileMigrationDialog({ profile, onClose, onMigrated }: Props) {
  const [registry, setRegistry] = useState<EnvironmentRegistry | null>(null);
  const [targetId, setTargetId] = useState('');
  const [report, setReport] = useState<ProfileCompatibilityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.atm.listAllegroEnvironments().then((result) => {
      if (result.success && result.data) setRegistry(result.data);
    });
  }, []);

  const targets = useMemo(
    () => registry?.environments.filter((environment) => environment.id !== registry.activeEnvironmentId) || [],
    [registry],
  );

  useEffect(() => {
    if (!targetId && targets[0]) setTargetId(targets[0].id);
  }, [targetId, targets]);

  const inspect = async () => {
    if (!targetId) return;
    setBusy(true);
    setError(null);
    const result = await window.atm.skillProfileCheckCompatibility(profile.id, targetId);
    setBusy(false);
    if (result.success && result.data) {
      setReport(result.data);
      const target = targets.find((item) => item.id === targetId);
      if (target && typeof window.atm.saveCompatibilityRecord === 'function') {
        await window.atm.saveCompatibilityRecord({
          environmentId: target.id,
          allegroVersion: target.allegroVersion,
          scope: 'skill',
          subjectId: profile.id,
          subjectType: 'profile',
          status: result.data.verdict === 'portable' ? 'static_pass' : result.data.verdict === 'blocked' ? 'blocked' : 'warning',
          evidenceSource: 'static',
          summary: 'Skill 方案“' + profile.name + '”静态兼容性检查：' + result.data.verdict,
          details: result.data.findings.map((finding) => finding.title + ': ' + finding.description).join('\n'),
        });
      }
    } else {
      setError(result.error || '兼容性检查失败');
    }
  };

  const migrate = async () => {
    if (!targetId || report?.verdict === 'blocked') return;
    setBusy(true);
    setError(null);
    const result = await window.atm.skillProfileMigrate(profile.id, targetId);
    setBusy(false);
    if (!result.success || !result.data) {
      setError(result.error || '迁移失败');
      return;
    }
    onMigrated(result.data.sharedPcbenv ? '目标版本共享同一个 pcbenv，无需复制方案' : '已在目标 Allegro 环境创建 Skill 方案副本');
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal skill-migration-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-migration-title">
        <div className="modal-header">
          <div><h2 id="skill-migration-title">迁移 Skill 方案</h2><p>先检查目标 Allegro 版本，再创建独立方案副本。</p></div>
          <button className="btn btn-sm" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body">
          <label className="form-group"><span>目标环境</span>
            <select value={targetId} onChange={(event) => { setTargetId(event.target.value); setReport(null); }}>
              {!targets.length ? <option value="">没有其他 Allegro 环境</option> : null}
              {targets.map((environment) => <option value={environment.id} key={environment.id}>{environment.name} · {environment.pcbenvPath}</option>)}
            </select>
          </label>
          {error ? <div className="message message-error">{error}</div> : null}
          {report ? (
            <section className={'compatibility-report compatibility-report--' + report.verdict}>
              <strong>{report.verdict === 'portable' ? '静态检查可迁移' : report.verdict === 'blocked' ? '存在阻断项' : '可以迁移，但需要验证'}</strong>
              {report.findings.length ? <ul>{report.findings.map((finding) => <li key={finding.code}><b>{finding.title}</b><span>{finding.description}</span></li>)}</ul> : <p>未发现已知兼容性风险。</p>}
            </section>
          ) : null}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn" disabled={!targetId || busy} onClick={() => void inspect()}>{busy ? '检查中…' : '检查兼容性'}</button>
          <button className="btn btn-primary" disabled={!report || report.verdict === 'blocked' || busy} onClick={() => void migrate()}>创建目标方案</button>
        </div>
      </div>
    </div>
  );
}
