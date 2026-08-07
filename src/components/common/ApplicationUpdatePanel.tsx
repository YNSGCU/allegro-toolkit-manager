import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, RefreshCw, RotateCw, Settings2, Save } from 'lucide-react';
import type { UpdateSettingsView, UpdateState } from '../../types/updates';

const initialState: UpdateState = { status: 'unsupported', currentVersion: 'unknown', message: '正在读取更新状态' };
const statusText: Record<UpdateState['status'], string> = {
  unconfigured: '未配置更新源', unsupported: '开发模式不执行更新', idle: '已是最新或可以检查', checking: '正在检查更新', available: '发现新版本', downloading: '正在下载', downloaded: '已下载，等待安装', error: '更新失败',
};

const ApplicationUpdatePanel: React.FC = () => {
  const [state, setState] = useState<UpdateState>(initialState);
  const [settings, setSettings] = useState<UpdateSettingsView | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [feedDraft, setFeedDraft] = useState('');

  useEffect(() => {
    if (typeof window.atm?.getUpdateState !== 'function') return;
    let active = true;
    void Promise.all([window.atm.getUpdateState(), window.atm.getUpdateSettings()]).then(([nextState, nextSettings]) => {
      if (active) { setState(nextState); setSettings(nextSettings); setFeedDraft(nextSettings?.settings?.feedUrl || ''); }
    }).catch((error) => {
      if (active) setState({ ...initialState, status: 'error', message: error instanceof Error ? error.message : '无法读取更新状态' });
    });
    const unsubscribe = typeof window.atm.onUpdateState === 'function'
      ? window.atm.onUpdateState((nextState) => active && setState(nextState))
      : () => undefined;
    return () => { active = false; unsubscribe(); };
  }, []);

  const run = async (action: () => Promise<UpdateState | void>) => {
    if (busy) return;
    setBusy(true);
    try { const next = await action(); if (next) setState(next); }
    catch (error) { setState((current) => ({ ...current, status: 'error', message: error instanceof Error ? error.message : '更新操作失败' })); }
    finally { setBusy(false); }
  };

  const handleSaveFeed = async () => {
    const url = feedDraft.trim();
    if (!url) { setState((current) => ({ ...current, status: 'error', message: '更新源不能为空' })); return; }
    await run(async () => {
      const updated = await window.atm.saveUpdateSettings({ feedUrl: url, connectionMode: 'system' });
      setSettings(updated);
      setShowConfig(false);
      return window.atm.checkForUpdates();
    });
  };

  const canUse = typeof window.atm?.getUpdateState === 'function';
  const sourceLabel = settings?.source === 'environment' ? '环境变量' : settings?.source === 'saved' ? '已保存设置' : settings?.source === 'default' ? '应用默认源' : '未配置';
  const StatusIcon = state.status === 'error' ? AlertCircle : state.status === 'idle' || state.status === 'downloaded' ? CheckCircle2 : RefreshCw;

  return (
    <section className="ui-update-panel" aria-label="应用内更新">
      <div className="ui-update-header">
        <div>
          <p className="ui-runtime-panel-eyebrow"><Settings2 aria-hidden="true" />应用维护</p>
          <h2>应用内更新</h2>
          <p className="ui-update-subtitle">当前版本 v{state.currentVersion} · 更新源：{sourceLabel}</p>
        </div>
        <span className={`ui-update-status ui-update-status--${state.status}`} aria-live="polite"><StatusIcon aria-hidden="true" />{statusText[state.status]}</span>
      </div>
      <div className="ui-update-body">
        <p className="ui-update-message" aria-live="polite">{state.message || statusText[state.status]}</p>
        {state.availableVersion ? <p className="ui-update-version">目标版本 <strong>v{state.availableVersion}</strong></p> : null}
        {state.status === 'downloading' ? <div className="ui-update-progress" aria-label={`下载进度 ${Math.round(state.progress || 0)}%`}><div><span style={{ width: `${Math.max(0, Math.min(100, state.progress || 0))}%` }} /></div><strong>{Math.round(state.progress || 0)}%</strong></div> : null}
        {state.releaseNotes ? <details className="ui-update-notes"><summary>查看更新说明</summary><p>{state.releaseNotes}</p></details> : null}
        {state.failure ? <div className="ui-update-error" role="alert"><AlertCircle aria-hidden="true" /><span>错误分类：{state.failure.code} · {state.failure.recoverable ? '可以重试' : '需要人工处理'}</span></div> : null}
        <div className="ui-update-actions">
          {state.status === 'available' ? <button className="btn btn-primary btn-sm" onClick={() => void run(() => window.atm.downloadUpdate())} disabled={busy || !canUse}><Download aria-hidden="true" />下载更新</button> : null}
          {state.status === 'downloaded' ? <button className="btn btn-primary btn-sm" onClick={() => void run(async () => { await window.atm.installUpdate(); })} disabled={busy || !canUse}><RotateCw aria-hidden="true" />重启并更新</button> : null}
          {(state.status === 'idle' || state.status === 'unconfigured' || state.status === 'error' || state.status === 'unsupported') ? <button className="btn btn-sm" onClick={() => void run(() => window.atm.checkForUpdates())} disabled={busy || !canUse}><RefreshCw aria-hidden="true" />检查更新</button> : null}
          <button className="btn btn-sm" onClick={() => { setShowConfig((v) => !v); setFeedDraft(settings?.settings?.feedUrl || ''); }} disabled={busy || !canUse}>
            <Settings2 aria-hidden="true" />{showConfig ? '收起配置' : '配置更新源'}
          </button>
        </div>
        {showConfig ? (
          <div className="ui-update-config">
            <label htmlFor="atm-update-feed">更新源地址（GitHub Releases 下载目录）</label>
            <div className="ui-update-config-row">
              <input
                id="atm-update-feed"
                type="text"
                value={feedDraft}
                onChange={(event) => setFeedDraft(event.target.value)}
                placeholder="https://github.com/owner/repo/releases/latest/download"
                disabled={busy}
              />
              <button className="btn btn-primary btn-sm" onClick={() => void handleSaveFeed()} disabled={busy || !feedDraft.trim()}>
                <Save aria-hidden="true" />保存并检查
              </button>
            </div>
            <p className="ui-update-config-hint">发布时使用 npm run publish:github，安装包会自动内置此更新源，一般无需手动配置。</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ApplicationUpdatePanel;
